# -*- coding: utf-8 -*-
"""① 规则层：同义词归一 + 黑名单拦截。

设计意图：把「高确定性」的列名映射用 0 成本 / 0 延迟 / 100% 可复现的方式解决，
只把长尾（同义改写、样本值才能判断的列）留给 LLM。
这一层的命中率决定了 token 成本和结果稳定性，是提示词工程的地基。
"""

import re
import unicodedata

_PAREN = re.compile(r"[（(【\[][^）)】\]]*[）)】\]]")
_PUNCT = re.compile(r"[\s_\-—–·•/\\:：,，.。、\"'`*#$%&+~|]+")

# 规则层命中时的置信度：同名/同义但毕竟不是规范列名，留一点余量给下游阈值判断
CONF_EXACT = 1.0
CONF_CONTAIN = 0.78
CONF_MIN = 0.6

# 包含匹配允许的最短同义词长度。2 字以下（编号 / 说明 / 备注）歧义太大，
# 只走精确匹配，不参与包含匹配。
MIN_CONTAIN_LEN = 3


def _contain_conf(header_norm, key):
    """包含匹配的置信度按覆盖率给：同义词几乎覆盖整个列名时才算可信。"""
    if not header_norm:
        return CONF_CONTAIN
    ratio = len(key) / float(len(header_norm))
    return CONF_EXACT - 0.1 if ratio >= 0.6 else CONF_CONTAIN


def norm(s):
    """归一化：全角转半角 → 去掉括号提示 → 去标点空白 → 小写。

    官方模板的列名自带必填提示，例如「会员卡号（必填）」「手机号（11位数字）」「有效期(月)」，
    真实文件里通常没有；统一剥掉括号内容，两边才能对上。
    注意「单价（元）」这种括号里是单位，剥掉后是「单价」，仍能命中同义词，符合预期。
    """
    if s is None:
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    s = _PAREN.sub("", s)
    s = _PUNCT.sub("", s)
    return s.strip().lower()


def _build_index(target):
    """构建 归一化同义词 → 标准字段。同义词撞车时标记歧义、不参与精确匹配。"""
    idx = {}
    clash = {}
    for f in target["fields"]:
        for syn in f["syn"]:
            key = norm(syn)
            if not key:
                continue
            if key in idx and idx[key] != f["std"]:
                clash.setdefault(key, {idx[key]}).add(f["std"])
            else:
                idx[key] = f["std"]
    for key in clash:
        idx.pop(key, None)
    return idx, clash


def _blocked(header, never):
    """黑名单：语义相近但业务含义不同的列，必须先拦住，避免规则层和模型都误挂。"""
    h = norm(header)
    for rule in never:
        if re.search(rule["pattern"], h):
            return rule["reason"]
    return None


def match_columns(header, target, never, use_containment=True):
    """对单个 sheet 的表头做规则层映射。

    返回与 header 等长的列表，每项：
      {src, std, confidence, evidence, via}
    std 为 None 表示规则层不处理（交给 LLM），via 取值 rule / blocked / none。
    """
    idx, clash = _build_index(target)
    out = []

    for raw in header:
        h = norm(raw)
        if not h:
            out.append({"src": raw, "std": None, "confidence": 0.0,
                        "evidence": "空列名", "via": "none"})
            continue

        reason = _blocked(raw, never)
        if reason:
            out.append({"src": raw, "std": None, "confidence": 0.0,
                        "evidence": reason, "via": "blocked"})
            continue

        if h in idx:
            out.append({"src": raw, "std": idx[h], "confidence": CONF_EXACT,
                        "evidence": "规则层：同名词典命中", "via": "rule"})
            continue

        hit = None
        if use_containment:
            # 包含匹配兜底：取最长的同义词，避免「余额」抢走「赠送余额」。
            # 关键约束：单字/双字同义词（如「编号」「说明」）不参与包含匹配——
            # 实测「卡面编号」会被「编号」吃掉判成「序号」，且置信度给到满值后
            # 模型再没机会纠正（见 _contain_conf）。宁可漏给模型，也不要错在本地。
            for key, std in idx.items():
                if len(key) < MIN_CONTAIN_LEN:
                    continue
                if key in h or h in key:
                    if hit is None or len(key) > hit[0]:
                        hit = (len(key), std, key)

        if hit:
            out.append({"src": raw, "std": hit[1], "confidence": _contain_conf(h, hit[2]),
                        "evidence": "规则层：包含匹配（%s）" % hit[2], "via": "rule"})
        else:
            out.append({"src": raw, "std": None, "confidence": 0.0,
                        "evidence": "规则层未命中" if h not in clash else "同义词存在歧义，交模型判定",
                        "via": "none"})

    return dedupe(out)


def dedupe(cols):
    """一个标准字段只允许被映射一次：保留置信度最高的源列，其余降级为未映射。"""
    best = {}
    for c in cols:
        if not c["std"]:
            continue
        cur = best.get(c["std"])
        if cur is None or c["confidence"] > cur["confidence"]:
            best[c["std"]] = c

    kept = set()
    for std, c in best.items():
        if "唯一映射该字段" not in c["evidence"]:
            c["evidence"] = c["evidence"].rstrip("；") + "；唯一映射该字段"
        kept.add(id(c))

    out = []
    for c in cols:
        if c["std"] and id(c) not in kept:
            other = best[c["std"]]
            out.append({"src": c["src"], "std": None, "confidence": 0.0,
                        "evidence": "与「%s」重复指向「%s」，保留后者" % (other["src"], c["std"]),
                        "via": "blocked"})
        else:
            out.append(c)
    return out
