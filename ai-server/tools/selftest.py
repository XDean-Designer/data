# -*- coding: utf-8 -*-
"""结构自检：不调模型，只验证「脚手架」是通的。

覆盖：字典与真值一致、prompt 渲染无残留占位符、JSON 校验器能拦住坏输出、判级规则正确、
规则层黑名单生效。

⚠️ 这里 PASS 只代表管线可用，**不代表映射准确率**。准确率看 out/report.md。
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.stdout.reconfigure(encoding="utf-8")

import dict_match  # noqa: E402
import llm  # noqa: E402
import validate  # noqa: E402

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  · " + detail) if (detail and not cond) else ""))
    if not cond:
        fails.append(name)


def load(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return json.load(f)


def main():
    dic = load("field-dict.json")
    cases = load(os.path.join("golden", "cases.json"))["cases"]
    never = dic.get("neverMap", [])

    print("[1/6] 字典与真值一致性")
    for c in cases:
        t = dic["targets"].get(c["target"])
        check("%s：类别存在" % c["id"], t is not None)
        if not t:
            continue
        stds = {f["std"] for f in t["fields"]}
        check("%s：真值键与表头一致" % c["id"],
              set(c["truth"]) == set(c["header"]),
              "差集 %s" % (set(c["truth"]) ^ set(c["header"])))
        bad = {s for acc in c["truth"].values() for s in acc if s not in stds}
        check("%s：真值字段都在字典里" % c["id"], not bad, str(bad))

    print("[2/6] prompt 渲染")
    member = dic["targets"]["member"]
    c = cases[0]
    msgs = llm.build_messages("member", member["label"], c["sheet"],
                              c["header"], c["samples"], member["fields"], never)
    joined = msgs[0]["content"] + "\n" + msgs[1]["content"]
    check("无残留占位符", "{{" not in joined and "}}" not in joined,
          [s for s in ("{{", "}}") if s in joined])
    left = [h for h in c["header"] if h not in msgs[1]["content"]]
    check("每列名都进了 user prompt", not left, str(left))
    miss = [f["std"] for f in member["fields"] if f["std"] not in msgs[0]["content"]]
    check("全部标准字段都进了 system prompt", not miss, str(miss))
    check("prompt 带 json 字样（json_object 模式要求）", "json" in joined.lower())
    print("        system %d 字 / user %d 字" % (len(msgs[0]["content"]), len(msgs[1]["content"])))

    print("[3/6] 输出校验器")
    ok = {"columns": [{"src": "性别", "std": "性别", "confidence": 0.9, "evidence": "同名"}]}
    check("合法输出通过", not validate.validate_colmap(ok, {"性别"}))
    bad1 = {"columns": [{"src": "性别", "std": "性别（男/女）", "confidence": 0.9, "evidence": "x"}]}
    check("自创字段被拦", any("自创" in e for e in validate.validate_colmap(bad1, {"性别"})))
    bad2 = {"columns": [{"src": "性别", "std": "性别", "confidence": 1.5, "evidence": "x"}]}
    check("confidence 越界被拦", any("越界" in e for e in validate.validate_colmap(bad2, {"性别"})))
    bad3 = {"columns": [{"src": "性别", "std": "性别", "confidence": 0.9}]}
    check("缺 evidence 被拦", any("evidence" in e for e in validate.validate_colmap(bad3, {"性别"})))
    bad4 = {"columns": [{"src": "a", "std": "性别", "confidence": 0.9, "evidence": "x"},
                        {"src": "b", "std": "性别", "confidence": 0.9, "evidence": "y"}]}
    check("列数与期望不符被拦",
          any("列数不符" in e for e in validate.validate_colmap(bad4, {"性别"}, expected_len=1)))

    print("[4/6] 判级规则")
    st = validate.decide({"手机号": 0.95}, member["fields"], 0.8)
    check("必填缺失 → 需修正", st["会员卡号"]["status"] == "需修正")
    check("非必填缺失 → 建议确认", st["性别"]["status"] == "建议确认")
    st2 = validate.decide({"手机号": 0.62}, member["fields"], 0.8)
    check("低置信 → 建议确认", st2["手机号"]["status"] == "建议确认")
    st3 = validate.decide({"手机号": 0.95}, member["fields"], 0.8)
    check("高置信 → 正常", st3["手机号"]["status"] == "正常")

    print("[5/6] 规则层行为")
    cols = {x["src"]: x for x in dict_match.match_columns(
        ["支付方式", "来源渠道", "会员卡号（必填）", "有效期(月)", "累计消费"], member, never)}
    check("「支付方式」被黑名单拦住", cols["支付方式"]["std"] is None and cols["支付方式"]["via"] == "blocked")
    check("「来源渠道」正常命中", cols["来源渠道"]["std"] == "来源渠道")
    check("括号提示被剥掉后仍能命中", cols["会员卡号（必填）"]["std"] == "会员卡号")
    check("「有效期(月)」命中有效期限", cols["有效期(月)"]["std"] == "有效期限")
    check("「累计消费」被黑名单拦住", cols["累计消费"]["via"] == "blocked")

    print("[6/6] 合并路径（用桩数据，不给模型打分）")
    import run as runner
    rule_cols = dict_match.match_columns(["客人称呼", "联络号码", "备注"], member, never)
    stub = {"columns": [
        {"src": "客人称呼", "std": "会员姓名", "confidence": 0.9, "evidence": "称呼即姓名"},
        {"src": "联络号码", "std": "手机号", "confidence": 0.92, "evidence": "样本 13800138000 为 11 位"},
        {"src": "备注", "std": "备注", "confidence": 0.99, "evidence": "同名"},
    ]}
    allowed = {f["std"] for f in member["fields"]}
    merged, errs = runner.merge(rule_cols, stub, [0, 1, 2], allowed)
    got = {c["src"]: c["std"] for c in merged}
    check("桩结果被合回", got.get("客人称呼") == "会员姓名" and got.get("联络号码") == "手机号", str(got))
    check("模型结果来源标记为 llm", [c["via"] for c in merged if c["src"] == "客人称呼"] == ["llm"])
    check("合并无校验错误", not errs, str(errs))

    print("")
    if fails:
        print("结构自检未通过：%d 项。注意：这不代表准确率，只代表管线有问题。" % len(fails))
        sys.exit(1)
    print("结构自检通过。注意：仅证明管线可用，准确率请看 out/report.md。")


if __name__ == "__main__":
    main()

