# -*- coding: utf-8 -*-
"""PoC 主流程：规则层 → 语义层（可选）→ 校验层 → 打分 → 报告。

用法：
    python src/run.py                    # 仅规则层（离线，不需要 API Key）
    set DEEPSEEK_API_KEY=sk-xxx
    python src/run.py --online           # 规则层 + DeepSeek 兜底（只送未命中的列）
    python src/run.py --online --llm-scope all    # 全表都送模型，测模型自身
    python src/run.py --case messy_price --online

注意：本脚本只使用示例 / golden 数据里的表头与样本值，不读取、不上传真实业务数据；
接入真实文件请先脱敏（姓名、手机号、卡号）。
"""

import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import dict_match  # noqa: E402
import llm  # noqa: E402
import validate  # noqa: E402


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve_target(dic, key):
    t = dic["targets"].get(key)
    if not t:
        raise SystemExit("field-dict.json 里没有类别：%s（可选：%s）" % (key, "、".join(dic["targets"])))
    return t


def rule_pass(case, target, never):
    return dict_match.match_columns(case["header"], target, never)


def llm_pass(case, target, never, scope, rule_cols):
    """只把规则层没吃掉的列送模型，省 token 也保住确定性。"""
    if scope == "all":
        idx = list(range(len(case["header"])))
    else:
        idx = [i for i, c in enumerate(rule_cols) if c["std"] is None and c["via"] != "blocked"]
    if not idx:
        return None, []

    header = [case["header"][i] for i in idx]
    samples = [[row[i] if i < len(row) else "" for i in idx] for row in case.get("samples") or []]
    res = llm.map_columns(
        case["target"], target["label"], case.get("sheet", ""),
        header, samples, target["fields"], never,
    )
    return res, idx


def merge(rule_cols, llm_res, llm_idx, allowed_std):
    """把模型结果按 src 合回规则层的列顺序。模型给了自创字段/低置信时降级。"""
    out = [dict(c) for c in rule_cols]
    errors = []
    if llm_res:
        errors = validate.validate_colmap(llm_res, allowed_std)
        by_src = {}
        for c in validate.sanitize(llm_res)["columns"]:
            by_src[c["src"]] = c
        for i in llm_idx:
            got = by_src.get(rule_cols[i]["src"])
            if not got:
                continue
            if got["std"] is not None and got["std"] not in allowed_std:
                continue  # 自创字段，丢弃，保持未映射
            out[i] = {
                "src": rule_cols[i]["src"],
                "std": got["std"],
                "confidence": got["confidence"],
                "evidence": got["evidence"],
                "via": "llm",
            }
    # 模型也可能把两列指向同一字段，合并后再去一次重
    return dict_match.dedupe(out), errors


def score_case(case, pred_by_src, via_by_src, target, llm_meta):
    truth = case["truth"]
    tp = fn = fp_wrong = fp_extra = tn = 0
    rows = []
    for src in case["header"]:
        accept = truth.get(src, [])
        pred = pred_by_src.get(src)
        if accept:
            if pred is None:
                fn += 1
                verdict = "漏挂"
            elif pred in accept:
                tp += 1
                verdict = "正确"
            else:
                fp_wrong += 1
                verdict = "错挂 → %s" % pred
        else:
            if pred is None:
                tn += 1
                verdict = "正确拒识"
            else:
                fp_extra += 1
                verdict = "误挂 → %s" % pred
        rows.append({
            "src": src, "pred": pred, "accept": accept, "verdict": verdict,
            "via": via_by_src.get(src), "samples": [r[case["header"].index(src)] for r in (case.get("samples") or [])][:2],
        })

    should = sum(1 for v in truth.values() if v)
    denom_p = tp + fp_wrong + fp_extra
    denom_r = tp + fn
    # 必填列召回：真值里挂了、且该字段标记必填的，我们有没有命中
    req_total = req_hit = 0
    for f in target["fields"]:
        if not f.get("required"):
            continue
        srcs = [s for s, acc in truth.items() if f["std"] in acc]
        if not srcs:
            continue
        req_total += 1
        if pred_by_src.get(srcs[0]) in truth[srcs[0]]:
            req_hit += 1

    return {
        "id": case["id"],
        "origin": case.get("origin", ""),
        "target": case["target"],
        "cols": len(case["header"]),
        "should_map": should,
        "should_refuse": len(case["header"]) - should,
        "tp": tp, "fn": fn, "fp_wrong": fp_wrong, "fp_extra": fp_extra, "tn": tn,
        "precision": (tp / denom_p) if denom_p else 1.0,
        "recall": (tp / denom_r) if denom_r else 1.0,
        "miss_rate": (fn / denom_r) if denom_r else 0.0,
        "over_map_rate": (fp_extra / (len(case["header"]) - should)) if (len(case["header"]) - should) else 0.0,
        "required_recall": (req_hit / req_total) if req_total else 1.0,
        "req_hit": req_hit, "req_total": req_total,
        "rule_resolved": sum(1 for r in rows if r["verdict"] == "正确" and r["via"] == "rule"),
        "llm_tokens": (llm_meta or {}).get("usage", {}),
        "llm_latency_ms": (llm_meta or {}).get("latency_ms", 0),
        "rows": rows,
    }


def fmt_pct(x):
    return "%.1f%%" % (x * 100)


def build_report(args, results, extra):
    L = []
    L.append("# T2 列名映射 PoC · 评测报告")
    L.append("")
    L.append("> 自动生成，请勿手改。重跑：`python src/run.py%s`" % (" --online" if args.online else ""))
    L.append("")
    L.append("## 运行配置")
    L.append("")
    L.append("| 项 | 值 |")
    L.append("|---|---|")
    L.append("| 模式 | %s |" % ("规则层 + DeepSeek" if args.online else "仅规则层（离线）"))
    L.append("| 模型 | %s |" % (extra.get("model") or "—"))
    L.append("| prompt 版本 | %s |" % llm.PROMPT_VERSION)
    L.append("| 模型调用范围 | %s |" % ("全表" if args.llm_scope == "all" else "仅规则层未命中的列"))
    L.append("| 置信度阈值 | %.2f |" % args.threshold)
    L.append("| 用例数 | %d |" % len(results))
    L.append("| 生成时间 | %s |" % time.strftime("%Y-%m-%d %H:%M:%S"))
    L.append("")

    if extra.get("errors"):
        L.append("## 告警")
        L.append("")
        for e in extra["errors"]:
            L.append("- " + e)
        L.append("")

    L.append("## 汇总指标")
    L.append("")
    tp = sum(r["tp"] for r in results)
    fn = sum(r["fn"] for r in results)
    fpw = sum(r["fp_wrong"] for r in results)
    fpe = sum(r["fp_extra"] for r in results)
    tn = sum(r["tn"] for r in results)
    should = sum(r["should_map"] for r in results)
    req_hit = sum(r["req_hit"] for r in results)
    req_total = sum(r["req_total"] for r in results)
    rule_ok = sum(r["rule_resolved"] for r in results)

    p = tp / (tp + fpw + fpe) if (tp + fpw + fpe) else 1.0
    r = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = 2 * p * r / (p + r) if (p + r) else 0.0

    L.append("| 指标 | 值 | 说明 |")
    L.append("|---|---|---|")
    L.append("| 列级准确率（precision） | **%s** | 我们挂的列里，挂对的比例 |" % fmt_pct(p))
    L.append("| 列级召回（recall） | **%s** | 该挂的列里，我们挂上的比例 |" % fmt_pct(r))
    L.append("| F1 | %s | |" % ("%.3f" % f1))
    L.append("| 错挂 | %d 列 | 挂上了但目标字段不对 |" % fpw)
    L.append("| 漏挂 | %d 列 | 该挂却没挂（用户要在概览里手工补） |" % fn)
    L.append("| 误挂（应拒识却挂了） | %d 列 | 最危险：会写进错误字段 |" % fpe)
    L.append("| 正确拒识 | %d 列 | |" % tn)
    L.append("| 必填列召回 | **%s** | %d / %d |" % (fmt_pct(req_hit / req_total if req_total else 1.0), req_hit, req_total))
    L.append("| 规则层单独命中 | %d / %d 列（%s） | 零成本零延迟那部分 |" % (rule_ok, should, fmt_pct(rule_ok / should if should else 1.0)))
    L.append("")

    if args.online:
        tok_in = sum((r["llm_tokens"] or {}).get("prompt_tokens", 0) or 0 for r in results)
        tok_out = sum((r["llm_tokens"] or {}).get("completion_tokens", 0) or 0 for r in results)
        cost = llm.cost_cny({"prompt_tokens": tok_in, "completion_tokens": tok_out})
        lat = [r["llm_latency_ms"] for r in results if r["llm_latency_ms"]]
        L.append("| 输入 token | %d | |" % tok_in)
        L.append("| 输出 token | %d | |" % tok_out)
        L.append("| 本批成本（估算） | ¥%.4f | 单价按官网当期价核对，见 `DS_PRICE_IN/OUT` |" % cost)
        if lat:
            L.append("| 单表延迟 | 平均 %d ms · 最大 %d ms | 一张表一次调用 |" % (sum(lat) // len(lat), max(lat)))
        L.append("")

    L.append("## 逐用例")
    L.append("")
    L.append("| 用例 | 列数 | 准确率 | 召回 | 错挂 | 漏挂 | 误挂 | 必填召回 |")
    L.append("|---|---|---|---|---|---|---|---|")
    for x in results:
        L.append("| %s | %d | %s | %s | %d | %d | %d | %s |" % (
            x["id"], x["cols"], fmt_pct(x["precision"]), fmt_pct(x["recall"]),
            x["fp_wrong"], x["fn"], x["fp_extra"], fmt_pct(x["required_recall"])))
    L.append("")

    for x in results:
        L.append("### %s" % x["id"])
        L.append("")
        L.append("%s" % x["origin"])
        L.append("")
        L.append("| 源列 | 样本值 | 预测 | 真值 | 判定 | 来源 |")
        L.append("|---|---|---|---|---|---|")
        for row in x["rows"]:
            pred = row["pred"] or "—"
            acc = "、".join(row["accept"]) if row["accept"] else "（应拒识）"
            samples = " / ".join(str(s)[:14] for s in row["samples"] if str(s) != "")
            L.append("| %s | %s | %s | %s | %s | %s |" % (
                row["src"], samples or "—", pred, acc, row["verdict"], row["via"] or "—"))
        L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--online", action="store_true", help="启用 DeepSeek 兜底")
    ap.add_argument("--llm-scope", choices=["unresolved", "all"], default="unresolved")
    ap.add_argument("--case", default=None, help="只跑某个用例 id")
    ap.add_argument("--threshold", type=float, default=validate.CONF_THRESHOLD)
    ap.add_argument("--out", default=os.path.join(ROOT, "out"))
    args = ap.parse_args()

    dic = load_json(os.path.join(ROOT, "field-dict.json"))
    cases = load_json(os.path.join(ROOT, "golden", "cases.json"))["cases"]
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            raise SystemExit("没有这个用例：%s" % args.case)

    if args.online and not os.environ.get("DEEPSEEK_API_KEY", "").strip():
        raise SystemExit("--online 需要先设置环境变量 DEEPSEEK_API_KEY")

    never = dic.get("neverMap", [])
    results, errors, model_used = [], [], None

    for case in cases:
        target = resolve_target(dic, case["target"])
        allowed = {f["std"] for f in target["fields"]}

        missing = set(case["header"]) - set(case["truth"])
        extra = set(case["truth"]) - set(case["header"])
        if missing or extra:
            errors.append("%s：真值与表头不匹配（缺 %s / 多 %s）"
                          % (case["id"], sorted(missing), sorted(extra)))

        rule_cols = rule_pass(case, target, never)
        llm_meta = None
        llm_idx = []

        if args.online:
            try:
                llm_meta, llm_idx = llm_pass(case, target, never, args.llm_scope, rule_cols)
                if llm_meta:
                    model_used = llm_meta.get("model")
            except llm.LlmError as e:
                errors.append("%s：模型调用失败 → %s" % (case["id"], e))

        merged, verr = merge(rule_cols, llm_meta, llm_idx, allowed)
        for e in verr:
            errors.append("%s：模型输出不合规 → %s" % (case["id"], e))

        pred_by_src = {c["src"]: c["std"] for c in merged}
        via_by_src = {c["src"]: c["via"] for c in merged}
        results.append(score_case(case, pred_by_src, via_by_src, target, llm_meta))

        # 判级演示：把合并结果按阈值落成「正常 / 建议确认 / 需修正」
        conf_by_std = {c["std"]: c["confidence"] for c in merged if c["std"]}
        statuses = validate.decide(conf_by_std, target["fields"], args.threshold)
        results[-1]["status_counts"] = validate.summarize(statuses)

    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "details.json"), "w", encoding="utf-8") as f:
        json.dump({"config": vars(args), "results": results, "errors": errors}, f,
                  ensure_ascii=False, indent=2)

    report = build_report(args, results, {"errors": errors, "model": model_used})
    rpath = os.path.join(args.out, "report.md")
    with open(rpath, "w", encoding="utf-8") as f:
        f.write(report)

    # 控制台摘要
    tp = sum(r["tp"] for r in results)
    fn = sum(r["fn"] for r in results)
    fpw = sum(r["fp_wrong"] for r in results)
    fpe = sum(r["fp_extra"] for r in results)
    p = tp / (tp + fpw + fpe) if (tp + fpw + fpe) else 1.0
    r_ = tp / (tp + fn) if (tp + fn) else 1.0
    print("模式：%s" % ("规则层 + DeepSeek" if args.online else "仅规则层（离线）"))
    print("用例：%d" % len(results))
    print("准确率 %s · 召回 %s · 错挂 %d · 漏挂 %d · 误挂 %d"
          % (fmt_pct(p), fmt_pct(r_), fpw, fn, fpe))
    for x in results:
        print("  %-22s 列 %2d  准确 %5s  召回 %5s  漏 %d 误 %d"
              % (x["id"], x["cols"], fmt_pct(x["precision"]), fmt_pct(x["recall"]),
                 x["fn"], x["fp_extra"]))
    for e in errors:
        print("  ! " + e)
    print("报告：%s" % rpath)


if __name__ == "__main__":
    main()
