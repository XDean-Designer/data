# -*- coding: utf-8 -*-
"""解析层（T1-lite）：把 Excel / CSV 变成「表头 + 数据行」。

真文件极少是干净的：上面可能有标题行、合并单元格、空行。这里只做两件确定的事：
1. 猜表头行（按「命中标准同义词的单元格数」打分，比按行号硬编码稳）；
2. 丢掉表头之前的行与全空行。

不做的事：合并单元格还原、多级表头合并、脚注识别——这些仍要人看。
"""

import csv
import io
import os
import re

MAX_ROWS = 3000          # 单表行上限，超过截断并告警
HEADER_SCAN = 12         # 只在最前面若干行里找表头
SAMPLES = 4              # 送给模型看的样本行数


def _norm_header_cell(s):
    from dict_match import norm
    return norm(s)


def synonym_index(dic):
    """所有目标类别的标准字段同义词合集，用于给表头行打分。"""
    from dict_match import norm
    idx = set()
    for t in dic["targets"].values():
        for f in t["fields"]:
            for syn in f["syn"]:
                k = norm(syn)
                if k:
                    idx.add(k)
    return idx


def guess_header_row(rows, syn_idx, scan=HEADER_SCAN):
    """返回 (行号, 命中数)。命中数 0 时退回第 0 行。"""
    best_i, best_hit, best_fill = 0, 0, -1
    for i, row in enumerate(rows[:scan]):
        cells = [str(c).strip() for c in row if str(c).strip()]
        if not cells:
            continue
        hit = sum(1 for c in cells if _norm_header_cell(c) in syn_idx)
        fill = len(cells)
        # 先比命中数，再比非空列数（命中数相同则取更宽的那行）
        if hit > best_hit or (hit == best_hit and fill > best_fill):
            best_i, best_hit, best_fill = i, hit, fill
    return best_i, best_hit


def trim_row(row):
    vals = ["" if c is None else str(c).strip() for c in row]
    while vals and vals[-1] == "":
        vals.pop()
    return vals


def rows_from_xlsx(path, sheet=None):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    raw = []
    for r in ws.iter_rows(values_only=True):
        raw.append(list(r))
        if len(raw) > MAX_ROWS + HEADER_SCAN:
            break
    return ws.title, raw


def sheets_from_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    out = []
    for ws in wb.worksheets:
        raw = []
        for r in ws.iter_rows(values_only=True):
            raw.append(list(r))
            if len(raw) > MAX_ROWS + HEADER_SCAN:
                break
        if raw:
            out.append((ws.title, raw))
    return out


def rows_from_xls(path, sheet=None):
    import xlrd
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_name(sheet) if sheet else wb.sheet_by_index(0)
    raw = []
    for i in range(min(ws.nrows, MAX_ROWS + HEADER_SCAN)):
        raw.append([ws.cell_value(i, j) for j in range(ws.ncols)])
    return ws.name, raw


def sheets_from_xls(path):
    import xlrd
    wb = xlrd.open_workbook(path)
    out = []
    for ws in wb.sheets():
        raw = []
        for i in range(min(ws.nrows, MAX_ROWS + HEADER_SCAN)):
            raw.append([ws.cell_value(i, j) for j in range(ws.ncols)])
        if raw:
            out.append((ws.name, raw))
    return out


def rows_from_csv(path):
    for enc in ("utf-8-sig", "gb18030", "utf-16"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return "CSV", [list(r) for r in csv.reader(f)]
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError("CSV 编码识别失败（试过 utf-8 / gb18030 / utf-16）")


def read_any(path, sheet=None):
    """读第一张 sheet（兼容旧调用）。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".xlsx":
        return rows_from_xlsx(path, sheet)
    if ext == ".xls":
        try:
            return rows_from_xls(path, sheet)
        except Exception:
            return rows_from_xlsx(path, sheet)
    if ext in (".csv", ".txt"):
        return rows_from_csv(path)
    raise ValueError("不支持的文件类型：%s（只支持 .xlsx / .xls / .csv）" % ext)


def read_book(path):
    """读**所有** sheet。卡模板一份文件里就有 5 个 sheet，只读第一张会漏 4 类。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".xlsx":
        return sheets_from_xlsx(path)
    if ext == ".xls":
        try:
            return sheets_from_xls(path)
        except Exception:
            # 不少「.xls」其实是 xlsx 改了扩展名
            return sheets_from_xlsx(path)
    if ext in (".csv", ".txt"):
        name, rows = rows_from_csv(path)
        return [(name, rows)]
    raise ValueError("不支持的文件类型：%s（只支持 .xlsx / .xls / .csv）" % ext)


def build_sheet(rows, syn_idx):
    """原始二维表 → {header, samples, rows, headerRow, headerHit}"""
    hdr_i, hit = guess_header_row(rows, syn_idx)
    header = trim_row(rows[hdr_i]) if hdr_i < len(rows) else []
    data = []
    for r in rows[hdr_i + 1:]:
        v = trim_row(r)
        if not v:
            continue
        v = (v + [""] * len(header))[:len(header)]
        data.append(v)
        if len(data) >= MAX_ROWS:
            break
    return {
        "header": header,
        "samples": data[:SAMPLES],
        "rows": data,
        "headerRow": hdr_i + 1,
        "headerHit": hit,
        "truncated": len(data) >= MAX_ROWS,
    }
