# -*- coding: utf-8 -*-
"""把「标准字段映射结果」翻译成原型 `checkData` 里的行（内部字段名）。

原型的数据模型是 {id, f, problems, ignored, aiFields}：
- f 存原表原值（这里只做**最小必要**清洗：去货币符号/千分位、日期分隔符归一、渠道取数字），
  不做猜测性填充——猜错会把错误藏起来；
- problems 由原型的 checkProblems() 算，本模块不碰；
- aiFields 存「靠模型推断出来的字段」，用于 UI 上的「AI 推断」标。
"""

import re

# 标准字段 → 原型内部字段名。同一内部字段可被多个标准列提供，按顺序取第一个非空。
MEMBER_KEY = [
    ("会员编号", "memberNo"),
    ("会员卡号", "cardNo"),
    ("会员姓名", "name"),
    ("手机号", "phone"),
    ("性别", "gender"),
    ("生日", "birthday"),
    ("备注", "note"),
    ("开卡店铺编码", "shopCode"),
    ("卡类型", "cardType"),
    ("卡名称", "cardName"),
    ("有效期限", "expiry"),
    ("充值余额", "recharge"),
    ("赠送余额", "bonus"),
    ("卡剩余价值", "remain"),
    ("计次卡剩余次数", "countLeft"),
    ("来源渠道", "channel"),
    ("赠送项目及余次", "gift"),
    ("特殊项目", "special"),
]

CARD_KEY = [
    ("卡名", "name"),
    ("购买价格", "price"),
    ("充值余额", "price"),
    ("享受折扣", "discount"),
    ("充值金额享受折扣", "discount"),
    ("次数", "times"),
    ("适用项目范围-次数", "times"),
    ("项目通用-次数", "times"),
    ("适用大类", "scope"),
    ("适用项目", "scope"),
    ("包含项目", "scope"),
    ("适用项目范围-项目清单", "scope"),
    ("适用项目-项目明细清单", "scope"),
    ("有效期限", "validity"),
    ("赠送项目", "gift"),
    ("会员价项目", "memberPrice"),
    ("卡项说明", "desc"),
]

PRICE_KEY = [
    ("项目名", "name"),
    ("项目组", "group"),
    ("价格", "price"),
    ("可开单与否", "bookable"),
    ("置顶与否", "top"),
    ("服务时长", "duration"),
    ("连锁店编码", "shopCode"),
]

MEMBER_FIELDS = ["memberNo", "cardNo", "name", "phone", "gender", "birthday", "note",
                 "shopCode", "cardType", "cardName", "expiry", "recharge", "bonus",
                 "remain", "countLeft", "channel", "gift", "special"]
CARD_FIELDS = ["type", "name", "price", "discount", "times", "scope", "validity",
               "gift", "memberPrice", "desc"]
PRICE_FIELDS = ["name", "group", "price", "bookable", "top", "duration", "shopCode"]

TARGET_CARD_TYPE = {
    "card_savings": "储值卡",
    "card_count": "计次卡",
    "card_discount": "折扣卡",
    "card_package": "套餐卡",
    "card_period": "周期卡",
}

_MONEY_JUNK = re.compile(r"[¥￥$,\s元人民币]")
_DATE_SEP = re.compile(r"[\-.]")
_DIGITS = re.compile(r"\d+")


def clean_money(v):
    if v is None:
        return ""
    s = _MONEY_JUNK.sub("", str(v)).strip()
    if s in ("", "-", "—", "无", "/"):
        return ""
    return s


def clean_date(v):
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    if s in ("永久", "长期", "无期限", "不限期"):
        return "永久"
    s = s.split(" ")[0].split("T")[0]
    m = re.match(r"^(\d{4})[\-/.](\d{1,2})[\-/.](\d{1,2})$", s)
    if m:
        return "%s/%d/%d" % (m.group(1), int(m.group(2)), int(m.group(3)))
    m = re.match(r"^(\d{4})[\-/.](\d{1,2})$", s)
    if m:
        return "%s/%d" % (m.group(1), int(m.group(2)))
    return s  # 解析不了就原样留着，让校验层标「建议确认」


def clean_bool(v):
    s = str(v).strip() if v is not None else ""
    if s in ("是", "Y", "y", "yes", "TRUE", "true", "1", "可", "允许"):
        return "是"
    if s in ("否", "N", "n", "no", "FALSE", "false", "0", "不可", "禁止"):
        return "否"
    return s


def clean_channel(v):
    """来源渠道只认 1–9；「2微商」这种带文字的取首个数字。"""
    s = str(v).strip() if v is not None else ""
    if not s:
        return ""
    if re.fullmatch(r"[1-9]", s):
        return s
    m = _DIGITS.search(s)
    if m and 1 <= int(m.group(0)) <= 9:
        return m.group(0)
    return s


def clean_int(v):
    s = str(v).strip() if v is not None else ""
    if not s:
        return ""
    m = re.match(r"^-?\d+(\.0+)?$", s)
    if m:
        return str(int(float(s)))
    return s


CLEANERS = {
    "recharge": clean_money, "bonus": clean_money, "remain": clean_money,
    "price": clean_money, "discount": clean_money, "memberPrice": None,
    "expiry": clean_date, "birthday": clean_date,
    "channel": clean_channel,
    "countLeft": clean_int, "times": clean_int, "duration": clean_int, "validity": clean_int,
    "bookable": clean_bool, "top": clean_bool,
}


def _resolve_value(row, mapping, std, idx_of, ai_set):
    """按 std 优先级取第一个非空值；同时记录该值是不是 AI 推断来的。"""
    for s, key in mapping:
        if s != std:
            continue
        pos = idx_of.get(s)
        if pos is None:
            continue
        val = row[pos] if pos < len(row) else ""
        if str(val).strip() == "":
            continue
        return val, (s in ai_set)
    return "", False


def build_rows(category, target_key, header, rows, colmap, threshold=0.8):
    """返回 (原型行列表, 统计)。

    colmap: [{'src','std','confidence','evidence','via'}]，与 header 等长。
    """
    # std → 列下标（同一 std 只可能有 1 个，去重由规则层保证）
    idx_of = {}
    ai_set = set()
    for c in colmap:
        if not c.get("std"):
            continue
        pos = header.index(c["src"]) if c["src"] in header else None
        if pos is None:
            continue
        idx_of[c["std"]] = pos
        if c.get("via") == "llm" or float(c.get("confidence") or 0) < threshold:
            ai_set.add(c["std"])

    if category == "card":
        keymap = CARD_KEY
        fields = CARD_FIELDS
        fixed = {"type": TARGET_CARD_TYPE.get(target_key, "")}
    elif category == "price":
        keymap = PRICE_KEY
        fields = PRICE_FIELDS
        fixed = {}
    else:
        keymap = MEMBER_KEY
        fields = MEMBER_FIELDS
        fixed = {}

    out = []
    for ri, row in enumerate(rows):
        f = {k: "" for k in fields}
        f.update(fixed)
        ai_fields = []
        for key in fields:
            if key in fixed:
                continue
            # 该内部字段能由哪些标准列提供
            stds = [s for s, k in keymap if k == key]
            for std in stds:
                if std not in idx_of:
                    continue
                val, is_ai = _resolve_value(row, keymap, std, idx_of, ai_set)
                if str(val).strip() == "":
                    continue
                cleaner = CLEANERS.get(key)
                v = cleaner(val) if cleaner else str(val).strip()
                f[key] = v
                if is_ai or key in ("type",):
                    ai_fields.append(key)
                break
        out.append({
            "id": "%s-%d" % (category[0], ri),
            "f": f,
            "problems": [],
            "ignored": False,
            "aiFields": sorted(set(ai_fields)),
        })

    mapped = sum(1 for c in colmap if c.get("std"))
    return out, {
        "rows": len(out),
        "columns": len(header),
        "mapped": mapped,
        "unmapped": len(header) - mapped,
        "filled": {k: sum(1 for r in out if str(r["f"].get(k, "")).strip()) for k in fields},
    }
