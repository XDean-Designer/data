# -*- coding: utf-8 -*-
"""照片层：把一张表格照片读成「表头 + 数据行」。

为什么单独一层：照片没有列名结构，必须先由视觉模型把像素变成二维表，
之后才能复用 Excel 那条链路（规则层 → 语义层 → 校验层）。
这样「拍照片」和「上传 Excel」在映射之后完全同构，只有入口不同。

约束：
- 只认表格照片；拍糊了、角度太斜、缺列，模型会返回短行/空单元格，
  这里**不猜**，交由上层校验标「需修正」。
- 模型可能把合计行、标题行一起读进 rows，这里不删除（删除属于业务判断，
  删错了比留着更难发现），由校验层按字段规则判出来。
"""

import os
import re
import time

import llm

PROMPT_VERSION = "t3-1.0.0"
MAX_EDGE = 1600          # 送模型前的最长边；太大徒增 token，太小看不清小字

SYSTEM = """你是表格照片的结构化抽取器。输入是一张表格照片，你要把表格还原成二维表。

铁律：
1. 只输出 JSON，不要任何解释、不要 markdown 围栏。
2. columns 必须是**照片里真实存在的表头原文**，逐字照抄，不要翻译、不要缩写、不要补全。
3. rows 每一行必须与 columns 等长；单元格内容逐字照抄。
4. 看不清的单元格填空字符串 ""，**不要猜、不要按上下文补全**。
5. 明显不是表头的装饰文字（店名、标题、页脚、拍摄日期）不要放进 columns。
6. 如果照片里没有可识别的表格，返回 {"columns": [], "rows": []}。

输出格式：
{"columns": ["列名1","列名2"], "rows": [["值","值"], ["值","值"]]}"""

USER_TMPL = """这是「{category}」类数据的一张表格照片。

请按 system 要求输出 JSON。注意：
- 表头可能在上方某一行的位置，也可能没有表头（此时 columns 给空数组）。
- 金额若带货币符号或千分位，照抄原文，不要自己换算。
- 手写体、印章遮挡、反光处看不清的，一律留空字符串。"""


def _key():
    k = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not k:
        raise llm.LlmError("未设置 DEEPSEEK_API_KEY")
    return k


def _shrink(data_url):
    """把照片压到最长边 MAX_EDGE。失败就原样返回——压图是省 token，不是必需。"""
    try:
        import base64
        import io

        from PIL import Image
    except ImportError:
        return data_url, None

    m = re.match(r"^data:image/[^;]+;base64,(.*)$", data_url, re.S)
    raw_b64 = m.group(1) if m else data_url
    try:
        raw = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(raw))
        img.load()
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w, h = img.size
        longest = max(w, h)
        if longest > MAX_EDGE:
            scale = MAX_EDGE / float(longest)
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))),
                             Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=88)
        out = base64.b64encode(buf.getvalue()).decode()
        return "data:image/jpeg;base64," + out, {"w": img.size[0], "h": img.size[1],
                                                 "bytes": len(buf.getvalue())}
    except Exception:
        return ("data:image/jpeg;base64," + raw_b64, None)


def read_table(data_url, category_label, model=None, retry=1):
    """照片 → {columns, rows, usage, latency_ms, model, prompt_version, size}"""
    key = _key()
    base = os.environ.get("DEEPSEEK_BASE_URL", llm.DEFAULT_BASE)
    model = model or os.environ.get("DEEPSEEK_VISION_MODEL", llm.VISION_MODEL)

    url, size = _shrink(data_url)
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": [
            {"type": "text", "text": USER_TMPL.format(category=category_label)},
            {"type": "image_url", "image_url": {"url": url}},
        ]},
    ]

    last_err = None
    for attempt in range(1, retry + 2):
        t0 = time.time()
        resp = llm._post(base, "/chat/completions", {
            "model": model,
            "messages": messages,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "max_tokens": 3000,
            "stream": False,
        }, key)
        latency = int((time.time() - t0) * 1000)
        try:
            content = resp["choices"][0]["message"]["content"]
            obj = llm._parse_json(content)
            return {
                "columns": _norm_columns(obj.get("columns") or []),
                "rows": _norm_rows(obj.get("rows") or []),
                "usage": resp.get("usage", {}),
                "latency_ms": latency,
                "model": model,
                "prompt_version": PROMPT_VERSION,
                "attempts": attempt,
                "image": size,
            }
        except (KeyError, IndexError, ValueError) as e:
            last_err = "输出不是合法 JSON（第 %d 次）：%s" % (attempt, e)
    raise llm.LlmError(last_err or "照片识别失败")


def _norm_columns(cols):
    out = []
    for c in cols:
        out.append("" if c is None else str(c).strip())
    return out


def _norm_rows(rows):
    out = []
    for r in rows:
        if not isinstance(r, (list, tuple)):
            continue
        out.append(["" if c is None else str(c).strip() for c in r])
    return out
