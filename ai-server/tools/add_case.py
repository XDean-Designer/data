# -*- coding: utf-8 -*-
"""把一份真实表格接进来：抽出表头 + 前几行样本，生成可直接粘进 golden/cases.json 的用例片段。

用法：
    python tools/add_case.py 我的会员表.xlsx --target member --sheet 会员 --id my_real_1

⚠️ 生成的片段里 truth 是空的，必须手工标注「每个源列对应哪个标准字段」才能参与打分；
   不标就粘进去，run.py 会把所有列当成「应拒识」，分数没有意义。
⚠️ 真实文件请先脱敏（姓名 / 手机号 / 卡号），本脚本只读表头和样本值。
"""

import argparse
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")


def read_rows(path, sheet=None, limit=6):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".xlsx":
        import openpyxl
        wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        ws = wb[sheet] if sheet else wb.worksheets[0]
        rows = []
        for r in ws.iter_rows(values_only=True):
            rows.append(["" if c is None else str(c) for c in r])
            if len(rows) >= limit + 1:
                break
        return ws.title, rows
    if ext == ".xls":
        import xlrd
        wb = xlrd.open_workbook(path)
        ws = wb.sheet_by_name(sheet) if sheet else wb.sheet_by_index(0)
        rows = []
        for i in range(min(limit + 1, ws.nrows)):
            rows.append([str(ws.cell_value(i, j)) for j in range(ws.ncols)])
        return ws.name, rows
    raise SystemExit("只支持 .xlsx / .xls")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--target", required=True, help="field-dict.json 里的类别 key")
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--id", default=None)
    ap.add_argument("--samples", type=int, default=4)
    args = ap.parse_args()

    sheet_name, rows = read_rows(args.file, args.sheet, args.samples)
    if not rows:
        raise SystemExit("表是空的")

    header = [h.strip() for h in rows[0]]
    # 去掉尾部空列
    while header and not header[-1]:
        header.pop()
    n = len(header)

    samples = []
    for r in rows[1:]:
        r = (r + [""] * n)[:n]
        if any(str(v).strip() for v in r):
            samples.append(r)

    stub = {
        "id": args.id or os.path.splitext(os.path.basename(args.file))[0],
        "origin": "真实样本 · %s（%s）" % (os.path.basename(args.file), sheet_name),
        "target": args.target,
        "sheet": sheet_name,
        "header": header,
        "samples": samples,
        "truth": {h: [] for h in header},
        "notes": "TODO：把 truth 里每个源列改成对应的标准字段名数组；确认应为拒识的列保持空数组。"
    }

    print("// 把下面这段补上 truth 后，追加到 golden/cases.json 的 cases 数组里")
    print(json.dumps(stub, ensure_ascii=False, indent=2))
    print("// 提示：truth 的可选字段见 field-dict.json → targets.%s.fields[].std" % args.target)


if __name__ == "__main__":
    main()
