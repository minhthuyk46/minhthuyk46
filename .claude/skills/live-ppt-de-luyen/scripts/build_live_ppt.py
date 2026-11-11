#!/usr/bin/env python3
"""Tạo PPT 16:9 chiếu câu đề luyện JLPT trên livestream.

Cách dùng:
    python3 build_live_ppt.py de.json [-o output.pptx]

Định dạng JSON: xem ../examples/n2_bunpou_01.json và SKILL.md.
Markup trong câu/đáp án:
    __chữ__        -> gạch chân (từ được hỏi ở 漢字読み/表記/言い換え)
    {漢字|かな}     -> hiện furigana nhỏ trong ngoặc: 漢字(かな)
    （　）          -> chỗ trống, giữ nguyên
    ★              -> ô sao của 並べ替え, tô màu
"""
import argparse
import json
import re
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

FONT = "Noto Sans JP"
FONT_FALLBACK_EA = "Meiryo"

THEMES = {
    "navy": dict(bg="0F1B33", card="FFFFFF", ink="1A1A1A", accent="F5A623",
                 sub="C9D3E6", ok="1E9E5A", ok_bg="E3F6EC", dim="9AA3B2",
                 dim_bg="F1F3F6", star="E0245E"),
    "light": dict(bg="F4F1EA", card="FFFFFF", ink="1A1A1A", accent="C0392B",
                  sub="5A5A5A", ok="1E8E4F", ok_bg="E3F6EC", dim="A0A0A0",
                  dim_bg="F2F2F2", star="C0392B"),
}

W, H = Inches(13.333), Inches(7.5)


def rgb(h):
    return RGBColor.from_string(h)


# ---------- text helpers ----------
TOKEN = re.compile(r"(__.+?__|\{[^|{}]+\|[^{}]+\}|★)")


def set_font(run, size, color, bold=False, underline=False):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.underline = underline
    f.color.rgb = rgb(color)
    f.name = FONT
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", FONT)
    # fallback hint for machines without Noto Sans JP
    rPr.set("altLang", "ja-JP")


def add_rich(paragraph, text, size, color, theme, bold=False):
    """Viết text có markup vào 1 paragraph."""
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith("__") and part.endswith("__"):
            inner = part[2:-2]
            add_rich_inner(paragraph, inner, size, theme["accent"] if color != theme["dim"] else color,
                           bold=True, underline=True, theme=theme)
        elif part.startswith("{"):
            kanji, kana = part[1:-1].split("|", 1)
            r = paragraph.add_run(); r.text = kanji
            set_font(r, size, color, bold)
            r = paragraph.add_run(); r.text = f"({kana})"
            set_font(r, max(size * 0.5, 10), color)
        elif part == "★":
            r = paragraph.add_run(); r.text = "★"
            set_font(r, size, theme["star"], True)
        else:
            r = paragraph.add_run(); r.text = part
            set_font(r, size, color, bold)


def add_rich_inner(paragraph, text, size, color, bold, underline, theme):
    for part in re.split(r"(\{[^|{}]+\|[^{}]+\})", text):
        if not part:
            continue
        if part.startswith("{"):
            kanji, kana = part[1:-1].split("|", 1)
            r = paragraph.add_run(); r.text = kanji
            set_font(r, size, color, bold, underline)
            r = paragraph.add_run(); r.text = f"({kana})"
            set_font(r, max(size * 0.5, 10), color, False, underline)
        else:
            r = paragraph.add_run(); r.text = part
            set_font(r, size, color, bold, underline)


def textbox(slide, x, y, w, h, text, size, color, theme, bold=False,
            align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, Inches(0.05))
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        add_rich(p, line, size, color, theme, bold)
    return tb


def box(slide, x, y, w, h, fill, line=None, radius=True):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, x, y, w, h)
    if radius:
        shp.adjustments[0] = 0.08
    shp.fill.solid(); shp.fill.fore_color.rgb = rgb(fill)
    if line:
        shp.line.color.rgb = rgb(line); shp.line.width = Pt(2.5)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def background(slide, theme):
    bg = slide.background.fill
    bg.solid(); bg.fore_color.rgb = rgb(theme["bg"])


def header(slide, meta, theme, right_text=""):
    left = f"{meta.get('level','')} {meta.get('sach','')}  ｜  {meta.get('hoi','')}".strip()
    textbox(slide, Inches(0.5), Inches(0.2), Inches(8.5), Inches(0.5), left, 16,
            theme["sub"], theme)
    if right_text:
        textbox(slide, Inches(8.5), Inches(0.2), Inches(4.35), Inches(0.5), right_text, 16,
                theme["accent"], theme, bold=True, align=PP_ALIGN.RIGHT)
    if meta.get("kenh"):
        textbox(slide, Inches(0.5), H - Inches(0.55), Inches(12.3), Inches(0.4),
                meta["kenh"], 12, theme["sub"], theme, align=PP_ALIGN.RIGHT)


def notes(slide, text):
    if text:
        slide.notes_slide.notes_text_frame.text = text


# ---------- slide builders ----------
def slide_cover(prs, meta, theme):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    textbox(s, Inches(0.8), Inches(1.4), Inches(11.7), Inches(0.8),
            meta.get("tieu_de_live", "LIVESTREAM LUYỆN ĐỀ JLPT"), 26, theme["accent"], theme, True)
    textbox(s, Inches(0.8), Inches(2.3), Inches(11.7), Inches(1.6),
            f"{meta.get('level','')} {meta.get('sach','')}", 54, "FFFFFF" if theme is THEMES["navy"] else theme["ink"],
            theme, True)
    textbox(s, Inches(0.8), Inches(3.9), Inches(11.7), Inches(1.0),
            meta.get("hoi", ""), 40, theme["sub"], theme, True)
    if meta.get("nguon"):
        textbox(s, Inches(0.8), Inches(6.2), Inches(11.7), Inches(0.5),
                "Nguồn: " + meta["nguon"], 14, theme["sub"], theme)
    if meta.get("ngay"):
        textbox(s, Inches(0.8), Inches(5.0), Inches(11.7), Inches(0.6),
                meta["ngay"], 22, theme["sub"], theme)
    notes(s, meta.get("ghi_chu_mo_dau", ""))


def slide_rules(prs, meta, theme, total):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme)
    box(s, Inches(0.8), Inches(1.1), Inches(11.7), Inches(5.6), theme["card"])
    t = meta.get("thoi_gian", "10 phút")
    lines = [
        f"⏱  Thời gian làm bài: {t}  ·  {total} câu",
        "💬  Comment đáp án theo cú pháp:",
        "      1-3  2-2  3-1  …",
        "🏆  Ai đúng hết được ghim tên cuối live!",
    ]
    textbox(s, Inches(1.3), Inches(1.6), Inches(10.8), Inches(4.8), lines, 34, theme["ink"], theme,
            anchor=MSO_ANCHOR.MIDDLE)
    notes(s, "Giới thiệu luật chơi, bật đồng hồ đếm ngược trên màn hình live.")


def slide_mondai(prs, meta, theme, mondai):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme)
    chip = box(s, Inches(0.8), Inches(2.2), Inches(3.2), Inches(1.0), theme["accent"])
    tf = chip.text_frame; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    add_rich(p, mondai["ten"], 32, "FFFFFF", theme, True)
    if mondai.get("dang"):
        textbox(s, Inches(4.3), Inches(2.35), Inches(8.2), Inches(0.8), mondai["dang"], 26,
                theme["sub"], theme, True)
    textbox(s, Inches(0.8), Inches(3.6), Inches(11.7), Inches(2.4), mondai.get("yeu_cau", ""),
            28, "FFFFFF" if theme is THEMES["navy"] else theme["ink"], theme)


def _option_layout(options):
    longest = max(len(re.sub(r"__|\{([^|]+)\|[^}]+\}", r"\1", o)) for o in options)
    if longest <= 5:
        return "grid4"   # 4 ô 1 hàng
    if longest <= 22:
        return "grid2"   # 2x2
    return "list"        # 用法: câu dài, xếp dọc


def draw_question(s, q, theme, reveal=False):
    is_sort = q.get("loai") == "sapxep"
    q_size = q.get("co_chu", 34 if len(q["cau"]) < 60 else 28)
    box(s, Inches(0.5), Inches(0.85), Inches(12.33), Inches(2.45 if not reveal else 2.2), theme["card"])
    num = box(s, Inches(0.75), Inches(1.1), Inches(0.9), Inches(0.9), theme["accent"])
    tf = num.text_frame; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    add_rich(p, str(q["so"]), 30, "FFFFFF", theme, True)
    textbox(s, Inches(1.9), Inches(1.0), Inches(10.7), Inches(2.1 if not reveal else 1.9),
            q["cau"], q_size, theme["ink"], theme, anchor=MSO_ANCHOR.MIDDLE)

    opts = q["lua_chon"]
    ans = q.get("dap_an")
    layout = _option_layout(opts)
    top = Inches(3.55 if not reveal else 3.25)
    avail_h = (Inches(6.85) if not reveal else Inches(4.75)) - top
    if layout == "grid4":
        cols, rows = 4, 1
    elif layout == "grid2":
        cols, rows = 2, 2
    else:
        cols, rows = 1, 4
    gap = Inches(0.18)
    cw = (Inches(12.33) - gap * (cols - 1)) / cols
    ch = (avail_h - gap * (rows - 1)) / rows
    o_size = {"grid4": 30, "grid2": 28, "list": 22}[layout]
    if reveal:
        o_size = {"grid4": 26, "grid2": 22, "list": 16}[layout]
    for i, o in enumerate(opts):
        r, c = divmod(i, cols)
        x = Inches(0.5) + (cw + gap) * c
        y = top + (ch + gap) * r
        n = i + 1
        is_ok = reveal and not is_sort and n == ans
        fill = theme["ok_bg"] if is_ok else (theme["dim_bg"] if reveal and not is_sort else theme["card"])
        line = theme["ok"] if is_ok else None
        b = box(s, int(x), int(y), int(cw), int(ch), fill, line)
        tf = b.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.margin_left = Inches(0.25)
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
        color = theme["ok"] if is_ok else (theme["dim"] if reveal and not is_sort else theme["ink"])
        r_ = p.add_run(); r_.text = f"{n}  "
        set_font(r_, o_size, theme["accent"] if not reveal or is_ok else theme["dim"], True)
        add_rich(p, o, o_size, color, theme, bold=is_ok)
        if is_ok:
            r_ = p.add_run(); r_.text = "  ✔"
            set_font(r_, o_size, theme["ok"], True)


def slide_question(prs, meta, theme, mondai, q):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme, f"{mondai['ten']}  ·  Câu {q['so']}")
    draw_question(s, q, theme, reveal=False)
    notes(s, q.get("ghi_chu_gv", "Đọc câu hỏi, cho người xem 30–45 giây suy nghĩ rồi mời comment."))


def slide_answer(prs, meta, theme, mondai, q):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme, f"{mondai['ten']}  ·  Đáp án câu {q['so']}")
    draw_question(s, q, theme, reveal=True)
    box(s, Inches(0.5), Inches(4.95), Inches(12.33), Inches(1.95), theme["card"])
    lines = []
    if q.get("loai") == "sapxep":
        lines.append(f"✔ Thứ tự đúng: {q.get('thu_tu','')}   →   ★ = {q['dap_an']}")
        if q.get("cau_hoan_chinh"):
            lines.append(q["cau_hoan_chinh"])
    else:
        lines.append(f"✔ Đáp án: {q['dap_an']}. {q['lua_chon'][q['dap_an']-1]}")
    if q.get("giai_thich"):
        lines.append("💡 " + q["giai_thich"])
    for k, v in (q.get("phuong_an_nhieu") or {}).items():
        lines.append(f"✘ {k}: {v}")
    size = 22 if len(lines) <= 3 else (19 if len(lines) <= 4 else 17)
    textbox(s, Inches(0.75), Inches(5.02), Inches(11.85), Inches(1.85), lines, size,
            theme["ink"], theme, anchor=MSO_ANCHOR.MIDDLE)
    notes(s, q.get("ghi_chu_dap_an", ""))


def slide_summary(prs, meta, theme, data):
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme, "BẢNG ĐÁP ÁN")
    items = [(m["ten"], q["so"], q["dap_an"]) for m in data["mondai"] for q in m["cau_hoi"]]
    n = len(items)
    cols = min(10, max(5, (n + 1) // 2 if n <= 20 else 10))
    rows = (n + cols - 1) // cols
    table_h = min(Inches(0.9) * rows * 2, Inches(5.6))
    tbl = s.shapes.add_table(rows * 2, cols, Inches(0.5), Inches(1.0), Inches(12.33), table_h).table
    for i, (mt, so, da) in enumerate(items):
        r, c = divmod(i, cols)
        for rr, txt, color, fill in ((r * 2, f"{mt.replace('問題','問')}-{so}", theme["sub"] if False else "FFFFFF", theme["accent"]),
                                     (r * 2 + 1, str(da), theme["ink"], theme["card"])):
            cell = tbl.cell(rr, c)
            cell.fill.solid(); cell.fill.fore_color.rgb = rgb(fill)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
            r_ = p.add_run(); r_.text = txt
            set_font(r_, 16 if rr % 2 == 0 else 28, color, True)
    for r in range(rows * 2):
        for c in range(cols):
            cell = tbl.cell(r, c)
            if not cell.text_frame.text:
                cell.fill.solid(); cell.fill.fore_color.rgb = rgb(theme["dim_bg"])
    notes(s, "Chốt đáp án, mời người xem tự chấm điểm và comment số điểm /"
             + str(meta.get("tong_diem", n)))


def slide_end(prs, meta, theme):
    end = meta.get("ket_thuc")
    if not end:
        return
    s = prs.slides.add_slide(prs.slide_layouts[6]); background(s, theme)
    header(s, meta, theme)
    lines = end if isinstance(end, list) else [end]
    textbox(s, Inches(0.8), Inches(1.5), Inches(11.7), Inches(5.0), lines, 34,
            "FFFFFF" if theme is THEMES["navy"] else theme["ink"], theme, True,
            anchor=MSO_ANCHOR.MIDDLE)


def build(data, out):
    meta = data.get("meta", {})
    theme = THEMES.get(meta.get("theme", "navy"), THEMES["navy"])
    mode = meta.get("che_do", "xen_ke")  # xen_ke | chua_sau
    prs = Presentation(); prs.slide_width, prs.slide_height = W, H
    total = sum(len(m["cau_hoi"]) for m in data["mondai"])
    slide_cover(prs, meta, theme)
    slide_rules(prs, meta, theme, total)
    if mode == "chua_sau":
        for m in data["mondai"]:
            slide_mondai(prs, meta, theme, m)
            for q in m["cau_hoi"]:
                slide_question(prs, meta, theme, m, q)
        textbox_slide = prs.slides.add_slide(prs.slide_layouts[6]); background(textbox_slide, theme)
        textbox(textbox_slide, Inches(0.8), Inches(2.5), Inches(11.7), Inches(2.5),
                ["⏰ HẾT GIỜ!", "Cùng chữa đề nhé 👇"], 54,
                "FFFFFF" if theme is THEMES["navy"] else theme["ink"], theme, True,
                align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        for m in data["mondai"]:
            for q in m["cau_hoi"]:
                slide_answer(prs, meta, theme, m, q)
    else:
        for m in data["mondai"]:
            slide_mondai(prs, meta, theme, m)
            for q in m["cau_hoi"]:
                slide_question(prs, meta, theme, m, q)
                slide_answer(prs, meta, theme, m, q)
    slide_summary(prs, meta, theme, data)
    slide_end(prs, meta, theme)
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
    a = ap.parse_args()
    with open(a.json, encoding="utf-8") as f:
        data = json.load(f)
    errs = validate(data)
    if errs:
        print("LỖI DỮ LIỆU:\n- " + "\n- ".join(errs)); sys.exit(1)
    out = a.out or a.json.rsplit(".", 1)[0] + ".pptx"
    n = build(data, out)
    print(f"OK: {out} ({n} slide)")
