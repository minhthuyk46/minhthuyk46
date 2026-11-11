#!/usr/bin/env python3
"""PPT dọc 9:16 (1080x1920) chiếu đề luyện JLPT trên TikTok LIVE.

    python3 build_live_ppt.py de.json [-o out.pptx] [--brand ../brand.json]

- Slide câu hỏi -> slide đáp án (chỉ tô màu khung đáp án đúng, không giải thích).
- Nội dung nằm trong VÙNG AN TOÀN của TikTok LIVE: tránh thanh avatar/người xem
  phía trên, cột icon bên phải, khung comment/quà phía dưới.
Markup: __gạch chân__  {漢字|かな}  ★  （　　）
"""
import argparse
import json
import os
import re
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = Inches(7.5), Inches(13.333)          # 1080 x 1920
# Vùng an toàn TikTok LIVE (inch, khung 7.5 x 13.333)
SAFE_L, SAFE_R = 0.35, 6.55                 # chừa ~0.95in cột icon bên phải
SAFE_T, SAFE_B = 1.75, 9.05                 # trên: avatar/viewer; dưới: comment + quà
SAFE_W = SAFE_R - SAFE_L

B = {}          # brand, nạp lúc chạy
FONT = "Noto Sans JP"


def c(key):
    return RGBColor.from_string(B["mau"][key])


TOKEN = re.compile(r"(__.+?__|\{[^|{}]+\|[^{}]+\}|★)")


def set_font(run, size, color, bold=False, underline=False):
    f = run.font
    f.size, f.bold, f.underline, f.name = Pt(size), bold, underline, FONT
    f.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {}); rPr.append(el)
        el.set("typeface", FONT)


def add_rich(p, text, size, color, bold=False, accent=None):
    accent = accent or c("chu_dao")
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith("__"):
            for sub in re.split(r"(\{[^|{}]+\|[^{}]+\})", part[2:-2]):
                if sub.startswith("{"):
                    k, kana = sub[1:-1].split("|", 1)
                    r = p.add_run(); r.text = k; set_font(r, size, accent, True, True)
                    r = p.add_run(); r.text = f"({kana})"; set_font(r, size * .5, accent, False, True)
                elif sub:
                    r = p.add_run(); r.text = sub; set_font(r, size, accent, True, True)
        elif part.startswith("{"):
            k, kana = part[1:-1].split("|", 1)
            r = p.add_run(); r.text = k; set_font(r, size, color, bold)
            r = p.add_run(); r.text = f"({kana})"; set_font(r, size * .5, color)
        elif part == "★":
            r = p.add_run(); r.text = "★"; set_font(r, size, accent, True)
        else:
            r = p.add_run(); r.text = part; set_font(r, size, color, bold)


def text(slide, x, y, w, h, lines, size, color, bold=False,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, Inches(0.04))
    for i, line in enumerate([lines] if isinstance(lines, str) else lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        add_rich(p, line, size, color, bold)
    return tb


def card(slide, x, y, w, h, fill, line=None, line_w=2.0, rad=0.12):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                               Inches(x), Inches(y), Inches(w), Inches(h))
    s.adjustments[0] = rad
    s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(line_w)
    s.shadow.inherit = False
    return s


def label(shape, txt, size, color, bold=True, align=PP_ALIGN.CENTER):
    tf = shape.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.12)
    p = tf.paragraphs[0]; p.alignment = align
    add_rich(p, txt, size, color, bold)


def base(prs, meta, right=""):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = c("nen")
    # dải màu thương hiệu mép trên (nằm dưới avatar TikTok, chỉ là trang trí)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, Inches(0.18))
    bar.fill.solid(); bar.fill.fore_color.rgb = c("chu_dao"); bar.line.fill.background()
    # thanh tiêu đề trong vùng an toàn
    pill = card(s, SAFE_L, SAFE_T, SAFE_W, 0.62, c("phu"), rad=0.5)
    label(pill, f"{meta.get('level','')} {meta.get('sach','')} ｜ {meta.get('hoi','')}"
          + (f"   {right}" if right else ""), 18, c("the"))
    logo = B.get("logo")
    if logo and os.path.exists(logo):
        s.shapes.add_picture(logo, Inches(SAFE_L), Inches(SAFE_B + 0.15), height=Inches(0.5))
    else:
        text(s, SAFE_L, SAFE_B + 0.1, SAFE_W, 0.45, B.get("ten_thuong_hieu", ""), 14,
             c("chu_dao"), True)
    return s


# ---------- slides ----------
def slide_cover(prs, meta):
    s = base(prs, meta)
    text(s, SAFE_L, 2.8, SAFE_W, 0.8, meta.get("tieu_de_live", "LUYỆN ĐỀ JLPT"), 30, c("chu_dao"), True,
         PP_ALIGN.CENTER)
    text(s, SAFE_L, 3.7, SAFE_W, 1.6, meta.get("level", ""), 96, c("phu"), True, PP_ALIGN.CENTER)
    text(s, SAFE_L, 5.3, SAFE_W, 0.9, meta.get("sach", ""), 44, c("phu"), True, PP_ALIGN.CENTER)
    pill = card(s, 1.6, 6.45, SAFE_W - 2.5, 0.95, c("chu_dao"), rad=0.5)
    label(pill, meta.get("hoi", ""), 36, c("chu_tren_dung"))
    if meta.get("ngay"):
        text(s, SAFE_L, 7.6, SAFE_W, 0.6, meta["ngay"], 22, c("chu"), False, PP_ALIGN.CENTER)
    if meta.get("nguon"):
        text(s, SAFE_L, 8.3, SAFE_W, 0.6, "Nguồn: " + meta["nguon"], 13, c("chu"), False, PP_ALIGN.CENTER)


def slide_rules(prs, meta, total):
    s = base(prs, meta)
    card(s, SAFE_L, 2.7, SAFE_W, 6.0, c("the"), c("vien_the"))
    text(s, SAFE_L + 0.3, 2.9, SAFE_W - 0.6, 5.6, [
        f"⏱ {meta.get('thoi_gian','10 phút')} · {total} câu",
        "",
        "💬 Comment đáp án:",
        "1-3  2-2  3-1 …",
        "",
        "🏆 Đúng hết được",
        "ghim tên cuối live!",
    ], 30, c("chu"), True, PP_ALIGN.CENTER)


def slide_mondai(prs, meta, m):
    s = base(prs, meta)
    pill = card(s, 1.4, 3.6, SAFE_W - 2.1, 1.1, c("chu_dao"), rad=0.5)
    label(pill, m["ten"], 44, c("chu_tren_dung"))
    if m.get("dang"):
        text(s, SAFE_L, 4.9, SAFE_W, 0.8, m["dang"], 28, c("phu"), True, PP_ALIGN.CENTER)
    if m.get("yeu_cau"):
        text(s, SAFE_L + 0.2, 5.9, SAFE_W - 0.4, 2.6, m["yeu_cau"], 22, c("chu"), False,
             PP_ALIGN.LEFT, MSO_ANCHOR.TOP)


def _plain_len(t):
    return len(re.sub(r"__|\{([^|]+)\|[^}]+\}", r"\1", t))


def slide_q(prs, meta, m, q, reveal):
    s = base(prs, meta, f"{m['ten']}-{q['so']}")
    # khung câu hỏi
    y0, qh = 2.6, 2.55
    card(s, SAFE_L, y0, SAFE_W, qh, c("the"), c("vien_the"))
    num = card(s, SAFE_L + 0.2, y0 + 0.2, 0.75, 0.75, c("chu_dao"), rad=0.5)
    label(num, str(q["so"]), 26, c("chu_tren_dung"))
    n = _plain_len(q["cau"])
    size = q.get("co_chu", 30 if n <= 28 else 26 if n <= 45 else 22)
    text(s, SAFE_L + 0.25, y0 + 0.95, SAFE_W - 0.5, qh - 1.05, q["cau"], size, c("chu"))
    # 4 lựa chọn xếp dọc (dễ đọc trên điện thoại)
    longest = max(_plain_len(o) for o in q["lua_chon"])
    osize = q.get("co_chu_lc", 28 if longest <= 10 else 22 if longest <= 18 else 17)
    top, gap = y0 + qh + 0.22, 0.16
    oh = (SAFE_B - 0.05 - top - gap * 3) / 4
    for i, o in enumerate(q["lua_chon"]):
        k = i + 1
        ok = reveal and k == q["dap_an"]
        box = card(s, SAFE_L, top + (oh + gap) * i, SAFE_W, oh,
                   c("dung") if ok else c("the"),
                   c("dung") if ok else c("vien_the"), 3 if ok else 1.5)
        tf = box.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.margin_left = Inches(0.3)
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
        col = c("chu_tren_dung") if ok else c("chu")
        r = p.add_run(); r.text = f"{k}   "
        set_font(r, osize, c("chu_tren_dung") if ok else c("chu_dao"), True)
        add_rich(p, o, osize, col, bold=ok, accent=col if ok else None)


def slide_times_up(prs, meta):
    s = base(prs, meta)
    text(s, SAFE_L, 3.5, SAFE_W, 3.5, ["⏰", "HẾT GIỜ!", "Cùng chữa đề nhé"], 44, c("chu_dao"), True,
         PP_ALIGN.CENTER)


def slide_summary(prs, meta, data):
    s = base(prs, meta, "ĐÁP ÁN")
    items = [(m["ten"].replace("問題", "問"), q["so"], q["dap_an"])
             for m in data["mondai"] for q in m["cau_hoi"]]
    cols = 4
    rows = (len(items) + cols - 1) // cols
    cw = (SAFE_W - 0.12 * (cols - 1)) / cols
    ch = min(0.95, (SAFE_B - 2.6 - 0.1 * (rows - 1)) / rows)
    for i, (mt, so, da) in enumerate(items):
        r, col = divmod(i, cols)
        x, y = SAFE_L + (cw + 0.12) * col, 2.6 + (ch + 0.1) * r
        b = card(s, x, y, cw, ch, c("the"), c("vien_the"))
        tf = b.text_frame; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        rr = p.add_run(); rr.text = f"{mt}-{so}  "; set_font(rr, 13, c("chu"))
        rr = p.add_run(); rr.text = str(da); set_font(rr, 28, c("chu_dao"), True)


def slide_end(prs, meta):
    end = meta.get("ket_thuc") or [B.get("slogan", "")]
    s = base(prs, meta)
    text(s, SAFE_L, 3.0, SAFE_W, 5.0, end if isinstance(end, list) else [end], 32, c("phu"), True,
         PP_ALIGN.CENTER)


def build(data, out):
    meta = data.get("meta", {})
    prs = Presentation(); prs.slide_width, prs.slide_height = W, H
    total = sum(len(m["cau_hoi"]) for m in data["mondai"])
    slide_cover(prs, meta)
    slide_rules(prs, meta, total)
    if meta.get("che_do", "xen_ke") == "chua_sau":
        for m in data["mondai"]:
            slide_mondai(prs, meta, m)
            for q in m["cau_hoi"]:
                slide_q(prs, meta, m, q, False)
        slide_times_up(prs, meta)
        for m in data["mondai"]:
            for q in m["cau_hoi"]:
                slide_q(prs, meta, m, q, True)
    else:
        for m in data["mondai"]:
            slide_mondai(prs, meta, m)
            for q in m["cau_hoi"]:
                slide_q(prs, meta, m, q, False)
                slide_q(prs, meta, m, q, True)
    slide_summary(prs, meta, data)
    slide_end(prs, meta)
    prs.save(out)
    return len(prs.slides)


def validate(data):
    errs = []
    for m in data.get("mondai", []):
        for q in m.get("cau_hoi", []):
            tag = f"{m.get('ten')} câu {q.get('so')}"
            if len(q.get("lua_chon", [])) != 4:
                errs.append(f"{tag}: cần đúng 4 lựa chọn")
            if q.get("dap_an") not in (1, 2, 3, 4):
                errs.append(f"{tag}: dap_an phải là 1–4")
            if q.get("loai") == "sapxep" and "★" not in q.get("cau", ""):
                errs.append(f"{tag}: câu 並べ替え phải có ★")
    return errs


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("-o", "--out")
    ap.add_argument("--brand", default=os.path.join(HERE, "..", "brand.json"))
    a = ap.parse_args()
    with open(a.brand, encoding="utf-8") as f:
        B.update(json.load(f))
    FONT = B.get("font", FONT)
    if B.get("logo") and not os.path.isabs(B["logo"]):
        B["logo"] = os.path.join(os.path.dirname(os.path.abspath(a.brand)), B["logo"])
    with open(a.json, encoding="utf-8") as f:
        data = json.load(f)
    errs = validate(data)
    if errs:
        print("LỖI DỮ LIỆU:\n- " + "\n- ".join(errs)); sys.exit(1)
    out = a.out or a.json.rsplit(".", 1)[0] + ".pptx"
    print(f"OK: {out} ({build(data, out)} slide)")
