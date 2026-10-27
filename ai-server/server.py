# -*- coding: utf-8 -*-
"""本地桥：给原型提供真实 AI 能力，同时把 Key 留在服务端。

为什么必须有这一层：
1. 浏览器直连 api.deepseek.com 会被 CORS 拦掉（服务端不返回允许跨域的响应头）；
2. 把 Key 写进 app.js 等于把 Key 发给每一个打开页面的人。

用法：
    cd ai-poc
    python server.py                 # 默认 http://127.0.0.1:8787
    python server.py --port 9000

然后浏览器打开 http://127.0.0.1:8787/  —— 原型目录由本服务托管，
页面里的相对路径、资源、以及 /api/ai/* 都走同一个源，不涉及跨域。

⚠️ 这是本地测试用的桥，不是生产服务：没有鉴权、没有并发控制、没有限流。
"""

import argparse
import base64
import json
import os
import sys
import tempfile
import threading
import traceback
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "src"))

import dict_match          # noqa: E402
import llm                 # noqa: E402
import parse_sheet         # noqa: E402
import to_rows             # noqa: E402
import validate            # noqa: E402

APP_DIR = os.path.dirname(HERE)          # ai-server 的上一级就是原型目录
DICT_PATH = os.path.join(HERE, "field-dict.json")
ENV_PATH = os.path.join(HERE, ".env.local")

MAX_BODY = 32 * 1024 * 1024     # base64 后约等于 24MB 原文件
ALLOWED_EXT = (".xlsx", ".xls", ".csv")

_dic = None
_lock = threading.Lock()


def load_dict():
    global _dic
    if _dic is None:
        with open(DICT_PATH, encoding="utf-8") as f:
            _dic = json.load(f)
    return _dic


def load_env_key():
    """优先环境变量，其次 .env.local（一行 DEEPSEEK_API_KEY=sk-xxx）。"""
    k = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if k:
        return k, "env"
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, _, val = line.partition("=")
                if name.strip() == "DEEPSEEK_API_KEY":
                    return val.strip().strip('"').strip("'"), "file"
    return "", "none"


def pick_target(dic, category, sheet, header):
    """T1-lite：按 sheet 名 + 规则层命中数，给这份表挑一个标准目标。

    卡模板有 5 个 sheet（储值/计次/折扣/套餐/周期），真实文件里 sheet 名千奇百怪，
    所以不只看名字，还看哪套字段能把这张表解释得最好。
    """
    targets = dic["targets"]
    never = dic.get("neverMap", [])
    if category in ("member", "price"):
        return category

    best_key, best_score = None, -1
    for key, t in targets.items():
        if not key.startswith("card_"):
            continue
        cols = dict_match.match_columns(header, t, never)
        # 命中字段数为主，置信度加权；sheet 名吻合再加分
        hits = sum(1 for c in cols if c["std"])
        score = hits + sum(c["confidence"] for c in cols if c["std"]) * 0.5
        if sheet and sheet.strip() in t.get("sheetHints", []):
            score += 6
        if score > best_score:
            best_key, best_score = key, score
    return best_key or "card_savings"


def convert_sheet(dic, category, target_key, file_name, sheet_name, sheet, online):
    target = dic["targets"][target_key]
    never = dic.get("neverMap", [])
    header = sheet["header"]
    if not header:
        raise ValueError("表头为空：%s / %s" % (file_name, sheet_name))

    rule_cols = dict_match.match_columns(header, target, never)

    llm_meta = None
    unresolved = [i for i, c in enumerate(rule_cols) if c["std"] is None and c["via"] != "blocked"]
    if online and unresolved:
        sub_header = [header[i] for i in unresolved]
        sub_samples = [[r[i] if i < len(r) else "" for i in unresolved] for r in sheet["samples"]]
        try:
            llm_meta = llm.map_columns(target_key, target["label"], sheet_name,
                                       sub_header, sub_samples, target["fields"], never)
        except llm.LlmError as e:
            llm_meta = {"error": str(e)}

    merged = [dict(c) for c in rule_cols]
    llm_errors = []
    if llm_meta and not llm_meta.get("error"):
        llm_errors = validate.validate_colmap(llm_meta, {f["std"] for f in target["fields"]})
        by_src = {c["src"]: c for c in validate.sanitize(llm_meta)["columns"]}
        for i in unresolved:
            got = by_src.get(header[i])
            if not got or not got["std"]:
                continue
            if got["std"] not in {f["std"] for f in target["fields"]}:
                continue
            merged[i] = {"src": header[i], "std": got["std"], "confidence": got["confidence"],
                         "evidence": got["evidence"], "via": "llm"}
        merged = dict_match.dedupe(merged)

    rows, stats = to_rows.build_rows(category, target_key, header, sheet["rows"],
                                     merged, validate.CONF_THRESHOLD)

    conf_by_std = {c["std"]: c["confidence"] for c in merged if c["std"]}
    statuses = validate.decide(conf_by_std, target["fields"], validate.CONF_THRESHOLD)

    usage = (llm_meta or {}).get("usage") or {}
    return {
        "file": file_name,
        "sheet": sheet_name,
        "target": target_key,
        "targetLabel": target["label"],
        "headerRow": sheet["headerRow"],
        "headerHit": sheet["headerHit"],
        "truncated": sheet["truncated"],
        "header": header,
        "mapping": merged,
        "columnStatus": statuses,
        "stats": stats,
        "llm": {
            "called": bool(llm_meta),
            "unresolvedInput": len(unresolved),
            "error": (llm_meta or {}).get("error"),
            "latencyMs": (llm_meta or {}).get("latency_ms", 0),
            "usage": usage,
            "promptVersion": llm.PROMPT_VERSION,
            "model": (llm_meta or {}).get("model"),
            "schemaErrors": llm_errors,
        },
        "rows": rows,
    }


def handle_convert(payload):
    dic = load_dict()
    category = payload.get("category")
    files = payload.get("files") or []
    online = payload.get("online", True)
    if category not in ("member", "card", "price"):
        raise ValueError("category 必须是 member / card / price")
    if not files:
        raise ValueError("没有文件")

    key, key_src = load_env_key()
    if online and not key:
        online = False
        key_hint = "未配置 DEEPSEEK_API_KEY，已降级为纯规则层"
    else:
        key_hint = ""
        if online:
            os.environ["DEEPSEEK_API_KEY"] = key

    syn_idx = parse_sheet.synonym_index(dic)
    results, warnings = [], []
    if key_hint:
        warnings.append(key_hint)

    for f in files:
        name = str(f.get("name") or "未命名")
        ext = os.path.splitext(name)[1].lower()
        if ext not in ALLOWED_EXT:
            warnings.append("跳过 %s：只支持 .xlsx / .xls / .csv" % name)
            continue
        try:
            raw = base64.b64decode(f.get("data") or "")
        except Exception:
            warnings.append("跳过 %s：base64 解码失败" % name)
            continue
        if not raw:
            warnings.append("跳过 %s：文件为空" % name)
            continue

        fd, tmp = tempfile.mkstemp(suffix=ext)
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(raw)
            try:
                book = parse_sheet.read_book(tmp)
            except Exception as e:
                warnings.append("跳过 %s：%s" % (name, e))
                continue
            if not book:
                warnings.append("跳过 %s：没有读到任何 sheet" % name)
                continue
            any_sheet = False
            for sheet_name, rows in book:
                sheet = parse_sheet.build_sheet(rows, syn_idx)
                if not sheet["header"]:
                    continue
                any_sheet = True
                target_key = pick_target(dic, category, sheet_name, sheet["header"])
                res = convert_sheet(dic, category, target_key, name, sheet_name, sheet, online)
                if not res["stats"]["mapped"]:
                    # 一列都对不上的 sheet 基本是参考页 / 说明页（卡模板里就有「项目定义」），
                    # 留在批次里会把成百上千行垃圾灌进概览，直接跳过但要说出来。
                    warnings.append("跳过「%s」的 sheet「%s」：没有任何列能对上标准字段"
                                    % (name, sheet_name))
                    continue
                res["fileSize"] = len(raw)
                results.append(res)
            if not any_sheet:
                warnings.append("跳过 %s：所有 sheet 都找不到表头" % name)
        except Exception as e:
            warnings.append("处理 %s 失败：%s" % (name, e))
            traceback.print_exc()
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass

    # 合并同一类别的所有行
    all_rows = []
    for r in results:
        all_rows.extend(r["rows"])
    for i, row in enumerate(all_rows):
        row["id"] = "%s-%d" % (category[0], i)

    return {
        "ok": True,
        "category": category,
        "online": online,
        "keySrc": key_src,
        "promptVersion": llm.PROMPT_VERSION,
        "sheets": [{k: v for k, v in r.items() if k != "rows"} for r in results],
        "rows": all_rows,
        "warnings": warnings,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("[bridge] %s\n" % (fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._json(204, {})

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/ai/health":
            key, src = load_env_key()
            return self._json(200, {
                "ok": True,
                "hasKey": bool(key),
                "keySrc": src,
                "model": os.environ.get("DEEPSEEK_MODEL", llm.DEFAULT_MODEL),
                "promptVersion": llm.PROMPT_VERSION,
                "appDir": APP_DIR,
            })
        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if path != "/api/ai/convert":
            return self._json(404, {"ok": False, "error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return self._json(400, {"ok": False, "error": "空请求体"})
        if length > MAX_BODY:
            return self._json(413, {"ok": False, "error": "请求体过大（上限约 24MB 原文件）"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as e:
            return self._json(400, {"ok": False, "error": "请求体不是合法 JSON：%s" % e})

        try:
            with _lock:                      # 单线程串行，原型自测够用
                res = handle_convert(payload)
            return self._json(200, res)
        except ValueError as e:
            return self._json(400, {"ok": False, "error": str(e)})
        except Exception as e:
            traceback.print_exc()
            return self._json(500, {"ok": False, "error": "%s: %s" % (type(e).__name__, e)})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    if not os.path.isdir(APP_DIR):
        raise SystemExit("找不到原型目录：%s" % APP_DIR)
    key, src = load_env_key()
    print("原型目录：%s" % APP_DIR)
    print("DeepSeek Key：%s" % ("已加载（来源 %s）" % src if key else "未配置 → 只能用规则层"))
    print("打开：http://%s:%d/" % (args.host, args.port))
    HTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
