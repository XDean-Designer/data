# -*- coding: utf-8 -*-
"""② 语义层：调用 DeepSeek 完成规则层没吃掉的列名映射。

只用标准库（urllib + json），不引入依赖，方便整段搬进后端服务。
"""
import json
import os
import re
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPT_VERSION = "t2-1.0.0"

DEFAULT_BASE = "https://api.deepseek.com"
# 用 /models 实际返回的模型 id。原先写的 deepseek-chat 不在该账号的模型列表里
# （能调通，属遗留别名），换新模型后端侧不再依赖未列出的别名。
DEFAULT_MODEL = "deepseek-flash"
VISION_MODEL = "deepseek-flash"      # 唯一 input_modalities 含 image 的模型
TIMEOUT = 60

# 成本估算用；单价按 DeepSeek 官网当期价核对后改，不入业务逻辑
PRICE_IN_PER_M = float(os.environ.get("DS_PRICE_IN", "2.0"))
PRICE_OUT_PER_M = float(os.environ.get("DS_PRICE_OUT", "8.0"))


class LlmError(RuntimeError):
    pass


def _read(name):
    with open(os.path.join(ROOT, "prompts", name), encoding="utf-8") as f:
        return f.read()


def load_system_template():
    """system prompt：取 markdown 中第一条 `---` 分隔线之后的正文。"""
    txt = _read("t2-map-columns.system.md")
    parts = txt.split("\n---\n")
    return parts[-1].strip()


def load_user_template():
    """user prompt：取 markdown 里的第一段围栏代码块。"""
    txt = _read("t2-map-columns.user.md")
    m = re.search(r"```\n(.*?)\n```", txt, re.S)
    if not m:
        raise LlmError("user prompt 模板缺少围栏代码块")
    return m.group(1)


def field_dict_text(fields):
    """把目标类别的字段表压成 prompt 用的一行一条。"""
    lines = []
    for f in fields:
        flag = "必填" if f.get("required") else "非必填"
        extras = "%s / %s" % (flag, f.get("type", "string"))
        if f.get("enum"):
            extras += " / 取值 " + "、".join(f["enum"])
        lines.append("- %s（%s）别名：%s" % (f["std"], extras, "、".join(f["syn"])))
    return "\n".join(lines)


def column_table(header, samples):
    """表头 + 每列样本，按列竖排输出（模型读列比读行稳）。"""
    n = len(header)
    rows = []
    for i in range(n):
        vals = []
        for row in samples or []:
            v = row[i] if i < len(row) else ""
            vals.append(v if str(v) != "" else "␀")
        rows.append("%d. %s\t%s" % (i + 1, header[i], " | ".join(vals)))
    return "\n".join(rows)


def build_messages(target_key, target_label, sheet, header, samples, fields, never):
    system = load_system_template().replace("{{FIELD_DICT}}", field_dict_text(fields))
    if never:
        ban = "\n".join("禁止映射：" + r["pattern"] + "（" + r["reason"] + "）" for r in never)
        system = system + "\n\n## 本批额外禁忌\n" + ban

    user = (load_user_template()
            .replace("{{TARGET_LABEL}}", target_label)
            .replace("{{TARGET_KEY}}", target_key)
            .replace("{{SHEET_NAME}}", str(sheet))
            .replace("{{COL_COUNT}}", str(len(header)))
            .replace("{{SAMPLE_N}}", str(len(samples or [])))
            .replace("{{COLUMN_TABLE}}", column_table(header, samples)))
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _post(base, path, payload, key):
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:400]
        raise LlmError("HTTP %s：%s" % (e.code, body))
    except urllib.error.URLError as e:
        raise LlmError("网络错误：%s" % e.reason)


def _parse_json(text):
    """模型偶尔仍会裹 ```json 围栏，剥掉再解析；失败就当成无效输出让上层重试。"""
    s = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(.*?)\s*```", s, re.S)
    if m:
        s = m.group(1)
    return json.loads(s)


def map_columns(target_key, target_label, sheet, header, samples, fields, never,
                model=None, retry=1):
    """调一次 T2，返回 {columns, usage, latency_ms, model, prompt_version, attempts}。"""
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise LlmError("未设置 DEEPSEEK_API_KEY")
    base = os.environ.get("DEEPSEEK_BASE_URL", DEFAULT_BASE)
    model = model or os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL)
    messages = build_messages(target_key, target_label, sheet, header, samples, fields, never)

    last_err = None
    for attempt in range(1, retry + 2):
        t0 = time.time()
        resp = _post(base, "/chat/completions", {
            "model": model,
            "messages": messages,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "max_tokens": 1600,
            "stream": False,
        }, key)
        latency = int((time.time() - t0) * 1000)
        try:
            content = resp["choices"][0]["message"]["content"]
            obj = _parse_json(content)
            return {
                "columns": obj.get("columns", []),
                "usage": resp.get("usage", {}),
                "latency_ms": latency,
                "model": model,
                "prompt_version": PROMPT_VERSION,
                "attempts": attempt,
            }
        except (KeyError, IndexError, ValueError) as e:
            last_err = "输出不是合法 JSON（第 %d 次）：%s" % (attempt, e)
    raise LlmError(last_err or "调用失败")


def cost_cny(usage):
    pin = (usage.get("prompt_tokens") or 0) / 1e6 * PRICE_IN_PER_M
    pout = (usage.get("completion_tokens") or 0) / 1e6 * PRICE_OUT_PER_M
    return pin + pout
