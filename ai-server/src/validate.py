# -*- coding: utf-8 -*-
"""③ 校验层：输出结构校验 + 「需修正 / 建议确认 / 正常」判定。

关键口径：判级**不交给模型**。模型只给 std + confidence，判级用固定阈值和固定规则，
保证同一份文件两次转换结论一致、且判级理由可解释（这与原型里
`f` 原值 / `problems` 校验 / `aiFields` 推断 的三分模型一一对应）。
"""

CONF_THRESHOLD = 0.8


def validate_colmap(obj, allowed_std, expected_len=None):
    """按 schema/colmap.schema.json 的约束做最小校验，返回错误列表（空 = 通过）。"""
    errors = []
    if not isinstance(obj, dict):
        return ["顶层不是 JSON 对象"]
    cols = obj.get("columns")
    if not isinstance(cols, list) or not cols:
        return ["缺少 columns 或为空"]

    if expected_len is not None and len(cols) != expected_len:
        errors.append("列数不符：期望 %d，实际 %d" % (expected_len, len(cols)))

    seen_src = set()
    for i, c in enumerate(cols):
        pos = "columns[%d]" % i
        if not isinstance(c, dict):
            errors.append(pos + " 不是对象")
            continue
        if not isinstance(c.get("src"), str) or not c["src"].strip():
            errors.append(pos + ".src 缺失")
        elif c["src"] in seen_src:
            errors.append(pos + ".src 重复：" + c["src"])
        else:
            seen_src.add(c["src"])

        std = c.get("std", "__missing__")
        if std == "__missing__":
            errors.append(pos + ".std 缺失")
        elif std is not None:
            if not isinstance(std, str):
                errors.append(pos + ".std 不是字符串")
            elif std not in allowed_std:
                errors.append(pos + ".std 自创字段：" + std)

        conf = c.get("confidence")
        if not isinstance(conf, (int, float)) or isinstance(conf, bool):
            errors.append(pos + ".confidence 不是数字")
        elif not 0 <= conf <= 1:
            errors.append(pos + ".confidence 越界：%s" % conf)

        ev = c.get("evidence")
        if not isinstance(ev, str) or not ev.strip():
            errors.append(pos + ".evidence 缺失")
    return errors


def sanitize(obj):
    """把模型输出洗成可直接落库的形状：只保留 schema 内字段，类型不合法的降级。"""
    out = []
    for c in (obj or {}).get("columns", []) or []:
        if not isinstance(c, dict):
            continue
        std = c.get("std")
        conf = c.get("confidence")
        conf = float(conf) if isinstance(conf, (int, float)) and not isinstance(conf, bool) else 0.0
        conf = max(0.0, min(1.0, conf))
        out.append({
            "src": str(c.get("src", "")).strip(),
            "std": std if isinstance(std, str) and std.strip() else None,
            "confidence": conf,
            "evidence": str(c.get("evidence") or "").strip()[:120],
        })
    return {"columns": out}


def decide(mapped_by_std, fields, threshold=CONF_THRESHOLD):
    """按标准字段判级。

    mapped_by_std: {std: confidence}
    返回 {std: {"status": 需修正|建议确认|正常, "why": str}}
    """
    result = {}
    for f in fields:
        std = f["std"]
        conf = mapped_by_std.get(std)
        if conf is None:
            if f.get("required"):
                result[std] = {"status": "需修正", "why": "必填列在源表中未找到"}
            else:
                result[std] = {"status": "建议确认", "why": "非必填列未找到，将补空值"}
        elif conf < threshold:
            result[std] = {"status": "建议确认", "why": "匹配置信度 %.2f 低于阈值 %.2f" % (conf, threshold)}
        else:
            result[std] = {"status": "正常", "why": "匹配置信度 %.2f" % conf}
    return result


def summarize(statuses):
    counts = {"正常": 0, "建议确认": 0, "需修正": 0}
    for v in statuses.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    return counts
