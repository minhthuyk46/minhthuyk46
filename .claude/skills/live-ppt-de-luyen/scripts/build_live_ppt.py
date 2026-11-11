#!/usr/bin/env python3
"""Slide luyện đề JLPT cho TikTok LIVE — khổ NGANG 16:9 (1920x1080), brand Mankai.

    python3 build_live_ppt.py de.json [-o out.pptx]

Bố cục live (khung dọc TikTok): camera Sensei ở trên, slide 16:9 nằm GIỮA khung
(full chiều ngang màn hình điện thoại), comment ở dưới. Slide không chứa camera.

Quy trình: JSON -> HTML từng slide (furigana <ruby> như sách) -> PNG (Playwright)
-> PPTX 16:9, mỗi slide 1 ảnh full khung.

Markup: {漢字|かな} furigana · __từ__ gạch chân · \\n xuống dòng · （　　） chỗ trống
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from pptx import Presentation
from pptx.util import Emu

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
W, H = 1920, 1080

CSS = r"""
:root{--cam:#F37142;--vang:#F3A41D;--ink:#2B1D16;--dao:#FDE3D3;--camdam:#C2461F;--line:#E5D9D0}
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;position:relative;overflow:hidden;background:#fff;
 font-family:"Be Vietnam Pro","Noto Sans JP",sans-serif;color:var(--ink)}
.sei{position:absolute;opacity:.10;background:
 radial-gradient(circle at 50% 100%,transparent 18px,var(--cam) 19px,var(--cam) 22px,transparent 23px,transparent 30px,var(--cam) 31px,var(--cam) 34px,transparent 35px,transparent 42px,var(--cam) 43px,var(--cam) 46px,transparent 47px) 0 0/100px 50px,
 radial-gradient(circle at 50% 100%,transparent 18px,var(--cam) 19px,var(--cam) 22px,transparent 23px,transparent 30px,var(--cam) 31px,var(--cam) 34px,transparent 35px,transparent 42px,var(--cam) 43px,var(--cam) 46px,transparent 47px) 50px 25px/100px 50px}
.jp{font-family:"Noto Sans JP",sans-serif}
.blank{display:inline-block;border:4px solid var(--ink);border-radius:10px;padding:0 18px;margin:0 6px;line-height:1.2;font-weight:800;background:var(--vang)}
ruby rt{font-size:.42em;font-weight:500;color:var(--ink)}
u{text-decoration-thickness:5px;text-underline-offset:12px;font-weight:700}
.title{position:absolute;top:34px;left:56px;right:56px;height:88px;border-radius:44px;background:var(--cam);
 display:flex;align-items:center;justify-content:space-between;padding:0 16px 0 40px;font-weight:800;font-size:42px;white-space:nowrap}
.title .p{background:#fff;border-radius:32px;padding:6px 26px;font-size:38px}
.q{position:absolute;top:156px;left:56px;right:56px;height:300px;border-radius:40px;background:#fff;border:5px solid var(--ink);
 box-shadow:10px 10px 0 var(--ink);padding:24px 48px;display:flex;gap:32px;align-items:center}
.num{flex:none;width:104px;height:104px;border-radius:50%;background:var(--vang);display:grid;place-items:center;font-weight:800;font-size:56px}
.qt{line-height:1.65;font-weight:500}
.opts{position:absolute;top:494px;left:56px;right:56px;display:grid;grid-template-columns:1fr 1fr;gap:28px 36px}
.o{height:168px;border-radius:32px;border:4px solid var(--line);background:#fff;display:flex;align-items:center;gap:30px;padding:0 40px;font-weight:500;line-height:1.45}
.o b{font-family:"Be Vietnam Pro";font-weight:800;color:var(--camdam);flex:none;font-size:1.05em}
.opts.long{top:370px;grid-template-columns:1fr;gap:20px}
.opts.long .o{height:auto;min-height:140px;padding:14px 40px}
.o.ok{background:var(--cam);border:5px solid var(--ink);box-shadow:8px 8px 0 var(--ink);font-weight:700}
.o.ok b{color:var(--ink)}
.o.dim{opacity:.30}
.st{position:absolute;top:906px;left:56px;height:118px;border-radius:59px;background:var(--dao);white-space:nowrap;
 display:flex;align-items:center;gap:26px;padding:0 44px 0 18px;font-size:46px;font-weight:700}
.t{background:var(--vang);border-radius:46px;padding:12px 30px;font-weight:800;font-size:50px}
.neko{position:absolute;right:56px;bottom:0;height:240px}
.pill{display:inline-block;background:var(--cam);border:5px solid var(--ink);box-shadow:10px 10px 0 var(--ink);border-radius:70px;padding:16px 64px;font-weight:800}
.card{position:absolute;border-radius:40px;background:#fff;border:5px solid var(--ink);box-shadow:10px 10px 0 var(--ink);padding:44px 56px}
.grid{position:absolute;left:56px;right:420px;top:170px;display:grid;grid-template-columns:repeat(6,1fr);gap:18px}
.cell{border-radius:24px;border:4px solid var(--line);background:#fff;height:112px;display:flex;align-items:center;justify-content:center;gap:14px}
.cell small{font-size:28px;font-weight:600}.cell span{font-size:58px;font-weight:800;color:var(--camdam)}
"""


def rich(t):
    t = html.escape(t)
    t = re.sub(r"\{([^|{}]+)\|([^{}]+)\}", r"<ruby>\1<rt>\2</rt></ruby>", t)
    t = re.sub(r"__(.+?)__", r"<u>\1</u>", t)
    t = re.sub(r"\[\[([0-9a-z\-]+)\]\]", r'<span class="blank">\1</span>', t)
    return t.replace("\\n", "<br>").replace("\n", "<br>")


def plain_len(t):
    return len(re.sub(r"__|\{([^|]+)\|[^}]+\}|\\n|\n", r"\1", t))


def page(body, neko=None, big_neko=False):
    font = "file://" + os.path.join(ASSETS, "fonts", "fonts.css")
    style = ' style="height:420px"' if big_neko else ""
    n = f'<img class="neko"{style} src="file://{ASSETS}/neko/{neko}.png">' if neko else ""
    return (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{font}">'
            f'<style>{CSS}</style></head><body><div class="sei" style="right:0;bottom:0;width:560px;height:260px"></div>'
            f'{body}{n}</body></html>')


def title_bar(meta, right):
    return (f'<div class="title"><span>Luyện đề {html.escape(meta["level"])} '
            f'<span class="jp">{html.escape(meta["sach"])}</span> · <span class="jp">{html.escape(meta["hoi"])}</span></span>'
            f'<span class="p jp">{right}</span></div>')


def slide_cover(meta, total):
    return page(f'''<div class="sei" style="left:0;top:0;width:100%;height:180px"></div>
<div style="position:absolute;top:150px;left:100px;font-size:52px;font-weight:800;color:var(--camdam)">LUYỆN ĐỀ JLPT CÙNG SENSEI</div>
<div style="position:absolute;top:220px;left:96px;font-size:260px;font-weight:800;line-height:1">{html.escape(meta["level"])}</div>
<div class="jp" style="position:absolute;top:300px;left:560px;font-size:110px;font-weight:700">{html.escape(meta["sach"])}</div>
<div style="position:absolute;top:530px;left:100px"><span class="pill jp" style="font-size:88px">{html.escape(meta["hoi"])}</span></div>
''', "vay-chao", True)


def slide_rules(meta, total):
    return page(f'''{title_bar(meta, "LUẬT CHƠI")}
<div class="card" style="top:250px;left:56px;right:520px;font-size:60px;font-weight:700;line-height:1.9;white-space:nowrap">
💬 Comment đáp án: <b style="color:var(--camdam)">1 / 2 / 3 / 4</b><br>🎁 Lụm list tổng hợp từ trúng tủ {html.escape(meta["level"])}<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;sau phiên live</div>
''', "vay-chao", True)


def slide_mondai(meta, m, idx, nm):
    return page(f'''{title_bar(meta, f"{idx}/{nm}")}
<div style="position:absolute;top:200px;left:56px"><span class="pill jp" style="font-size:96px">{html.escape(m["ten"])}</span></div>
<div class="jp" style="position:absolute;top:240px;left:560px;font-size:64px;font-weight:700">{html.escape(m.get("dang",""))}</div>
<div class="card jp" style="top:430px;left:56px;right:520px;font-size:54px;line-height:1.7;font-weight:500">{rich(m.get("yeu_cau",""))}</div>
''', "suy-nghi", True)


def slide_passage(meta, m):
    size = m.get("co_chu_doan", 40)
    paras = "".join(f'<p style="text-indent:1em;margin-bottom:10px">{rich(x)}</p>' for x in m["doan_van"].split("\n"))
    return page(f'''{title_bar(meta, f"{m['ten']} · 文章")}
<div class="card jp" style="top:150px;left:56px;right:56px;bottom:40px;padding:30px 48px;font-size:{size}px;line-height:1.85;font-weight:500">{paras}</div>''')


def slide_q(meta, m, q, reveal):
    n = len(m["cau_hoi"])
    long_opts = max(plain_len(o) for o in q["lua_chon"]) > 11
    ql = plain_len(q["cau"])
    opts = ""
    osize = q.get("co_chu_lc", 66 if not long_opts else 46)
    for i, o in enumerate(q["lua_chon"]):
        k = i + 1
        cls = ("ok" if k == q["dap_an"] else "dim") if reveal else ""
        opts += f'<div class="o {cls}" style="font-size:{osize}px"><b>{k}</b><span>{rich(o)}</span></div>'
    head = title_bar(meta, f"{m['ten']} · {q['so']}/{n}")
    if long_opts:  # 用法: từ được hỏi + 4 câu dài xếp dọc full ngang
        qsize = q.get("co_chu", 84 if ql <= 8 else 48)
        qh = 180 if ql <= 8 else 230
        return page(f'''{head}
<div class="q" style="height:{qh}px"><div class="num">{q["so"]}</div><div class="qt jp" style="font-size:{qsize}px">{rich(q["cau"])}</div></div>
<div class="opts long jp" style="top:{qh + 190}px">{opts}</div>''')
    qsize = q.get("co_chu", 84 if ql <= 8 else 66 if ql <= 24 else 58 if ql <= 34 else 52)
    st = (f'<span class="t">✔ Đáp án {q["dap_an"]}</span>' if reveal
          else '<span class="t">⏱ 0:25</span>💬 Comment 1 – 4')
    return page(f'''{head}
<div class="q"><div class="num">{q["so"]}</div><div class="qt jp" style="font-size:{qsize}px">{rich(q["cau"])}</div></div>
<div class="opts jp">{opts}</div><div class="st">{st}</div>''', "bien-dung" if reveal else "suy-nghi")


def slide_summary(meta, data):
    cells = "".join(
        f'<div class="cell"><small class="jp">{html.escape(m["ten"].replace("問題","問"))}-{q["so"]}</small><span>{q["dap_an"]}</span></div>'
        for m in data["mondai"] for q in m["cau_hoi"])
    return page(f'''{title_bar(meta, "ĐÁP ÁN")}
<div class="grid">{cells}</div>
<div class="st">🎯 Comment số câu bạn làm đúng!</div>''', "cup-vang", True)


def slide_end(meta):
    lines = meta.get("ket_thuc") or ["Hẹn gặp lại buổi sau!"]
    return page(f'''{title_bar(meta, "HẸN GẶP LẠI")}
<div class="card" style="top:260px;left:56px;right:520px;font-size:68px;font-weight:800;line-height:1.6">{"<br>".join(rich(x) for x in lines)}</div>''',
                "vay-chao", True)


def build(data, out):
    meta = data["meta"]
    mondai = data["mondai"]
    total = sum(len(m["cau_hoi"]) for m in mondai)
    pages = [slide_cover(meta, total), slide_rules(meta, total)]
    for i, m in enumerate(mondai, 1):
        pages.append(slide_mondai(meta, m, i, len(mondai)))
        if m.get("doan_van"):
            pages.append(slide_passage(meta, m))
        for q in m["cau_hoi"]:
            pages += [slide_q(meta, m, q, False), slide_q(meta, m, q, True)]
    pages += [slide_summary(meta, data), slide_end(meta)]

    tmp = tempfile.mkdtemp()
    try:
        for i, h in enumerate(pages):
            with open(os.path.join(tmp, f"{i:03d}.html"), "w", encoding="utf-8") as f:
                f.write(h)
        env = dict(os.environ, W=str(W), H=str(H))
        subprocess.run(["node", os.path.join(HERE, "render.cjs"), tmp], check=True, cwd="/tmp", env=env)
        prs = Presentation()
        prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 13.333 x 7.5 in
        for i in range(len(pages)):
            s = prs.slides.add_slide(prs.slide_layouts[6])
            s.shapes.add_picture(os.path.join(tmp, f"{i:03d}.png"), 0, 0, prs.slide_width, prs.slide_height)
        prs.save(out)
        if os.environ.get("KEEP_PNG"):
            png_dir = os.path.splitext(out)[0] + "_png"
            shutil.rmtree(png_dir, ignore_errors=True)
            os.makedirs(png_dir)
            for i in range(len(pages)):
                shutil.copy(os.path.join(tmp, f"{i:03d}.png"), png_dir)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return len(pages)


def validate(data):
    errs = []
    for m in data.get("mondai", []):
        for q in m.get("cau_hoi", []):
            tag = f"{m.get('ten')} câu {q.get('so')}"
            if len(q.get("lua_chon", [])) != 4:
                errs.append(f"{tag}: cần đúng 4 lựa chọn")
            if q.get("dap_an") not in (1, 2, 3, 4):
                errs.append(f"{tag}: dap_an phải là 1–4")
    return errs


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    data = json.load(open(a.json, encoding="utf-8"))
    errs = validate(data)
    if errs:
        print("LỖI DỮ LIỆU:\n- " + "\n- ".join(errs)); sys.exit(1)
    out = os.path.abspath(a.out or a.json.rsplit(".", 1)[0] + ".pptx")
    print(f"OK: {out} ({build(data, out)} slide)")
