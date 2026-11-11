#!/usr/bin/env python3
"""Slide luyện đề JLPT cho TikTok LIVE (dọc 1080x1920, brand Mankai).

    python3 build_live_ppt.py de.json [-o out.pptx]

Quy trình: JSON -> HTML từng slide (furigana dạng <ruby> như sách) -> PNG (Playwright)
-> PPTX mỗi slide 1 ảnh full khung. Camera Sensei xoá phông ghép ở góc phải dưới
trong LIVE Studio (vùng x 760–1050, y 770–1320 để trống sẵn).

Markup trong JSON:
    {漢字|かな}   furigana        __chữ__  gạch chân (từ được hỏi)
    （　　）      chỗ trống       \n       xuống dòng (hội thoại A/B)
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

CSS = r"""
:root{--cam:#F37142;--vang:#F3A41D;--ink:#2B1D16;--dao:#FDE3D3;--camdam:#C2461F}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;position:relative;overflow:hidden;background:#fff;
 font-family:"Be Vietnam Pro","Noto Sans JP",sans-serif;color:var(--ink)}
.sei{position:absolute;left:0;right:0;opacity:.10;background:
 radial-gradient(circle at 50% 100%,transparent 18px,var(--cam) 19px,var(--cam) 22px,transparent 23px,transparent 30px,var(--cam) 31px,var(--cam) 34px,transparent 35px,transparent 42px,var(--cam) 43px,var(--cam) 46px,transparent 47px) 0 0/100px 50px,
 radial-gradient(circle at 50% 100%,transparent 18px,var(--cam) 19px,var(--cam) 22px,transparent 23px,transparent 30px,var(--cam) 31px,var(--cam) 34px,transparent 35px,transparent 42px,var(--cam) 43px,var(--cam) 46px,transparent 47px) 50px 25px/100px 50px}
.jp{font-family:"Noto Sans JP",sans-serif}
ruby rt{font-size:.42em;font-weight:500;color:var(--ink)}
u{text-decoration-thickness:4px;text-underline-offset:10px;font-weight:700}
.title{position:absolute;top:268px;left:210px;right:80px;height:76px;border-radius:38px;background:var(--cam);
 display:flex;align-items:center;justify-content:space-between;padding:0 14px 0 30px;font-weight:800;font-size:31px;white-space:nowrap}
.title .p{background:#fff;border-radius:26px;padding:4px 18px;font-size:28px}
.q{position:absolute;top:378px;left:90px;right:90px;height:280px;border-radius:36px;background:#fff;border:4px solid var(--ink);
 box-shadow:8px 8px 0 var(--ink);padding:20px 34px;display:flex;gap:22px;align-items:center}
.num{flex:none;width:76px;height:76px;border-radius:50%;background:var(--vang);display:grid;place-items:center;font-weight:800;font-size:40px}
.qt{line-height:1.7;font-weight:500}
.opts{position:absolute;top:700px;left:90px;width:660px;display:flex;flex-direction:column;gap:18px}
.o{height:104px;border-radius:28px;border:3px solid #E5D9D0;background:#fff;display:flex;align-items:center;gap:22px;padding:0 26px;font-weight:500;line-height:1.5}
.o b{font-family:"Be Vietnam Pro";font-weight:800;color:var(--camdam);flex:none;width:30px}
.opts.long{width:900px;gap:18px}
.opts.long .o{height:auto;min-height:96px;padding:12px 24px}
.o.ok{background:var(--cam);border:4px solid var(--ink);box-shadow:6px 6px 0 var(--ink);font-weight:700}
.o.ok b{color:var(--ink)}
.o.dim{opacity:.33}
.st{position:absolute;top:1200px;left:90px;height:96px;border-radius:48px;background:var(--dao);white-space:nowrap;
 display:flex;align-items:center;gap:18px;padding:0 30px 0 14px;font-size:30px;font-weight:700}
.t{background:var(--vang);border-radius:36px;padding:10px 22px;font-weight:800;font-size:34px}
.camzone{position:absolute;right:30px;top:770px;width:290px;height:550px;border-radius:145px 145px 28px 28px;background:var(--dao);opacity:.55}
.neko{position:absolute;left:585px;top:1125px;height:205px}
.big{position:absolute;left:90px;right:90px;text-align:center}
.pill{display:inline-block;background:var(--cam);border:4px solid var(--ink);box-shadow:8px 8px 0 var(--ink);border-radius:60px;padding:14px 56px;font-weight:800}
.card{position:absolute;left:90px;right:90px;border-radius:36px;background:#fff;border:4px solid var(--ink);box-shadow:8px 8px 0 var(--ink);padding:36px 40px}
.grid{position:absolute;left:90px;width:660px;top:400px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.cell{border-radius:22px;border:3px solid #E5D9D0;background:#fff;height:96px;display:flex;align-items:center;justify-content:center;gap:12px}
.cell small{font-size:22px;font-weight:600}.cell span{font-size:44px;font-weight:800;color:var(--camdam)}
"""


def rich(t):
    t = html.escape(t)
    t = re.sub(r"\{([^|{}]+)\|([^{}]+)\}", r"<ruby>\1<rt>\2</rt></ruby>", t)
    t = re.sub(r"__(.+?)__", r"<u>\1</u>", t)
    return t.replace("\\n", "<br>").replace("\n", "<br>")


def plain_len(t):
    return len(re.sub(r"__|\{([^|]+)\|[^}]+\}|\\n|\n", r"\1", t))


def page(body, neko=None, cam=True):
    font = "file://" + os.path.join(ASSETS, "fonts", "fonts.css")
    n = f'<img class="neko" src="file://{ASSETS}/neko/{neko}.png">' if neko else ""
    cz = '<div class="camzone"></div>' if cam else ""
    return (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{font}">'
            f'<style>{CSS}</style></head><body><div class="sei" style="top:0;height:240px"></div>'
            f'<div class="sei" style="top:1360px;bottom:0"></div>{cz}{body}{n}</body></html>')


def title_bar(meta, right):
    return (f'<div class="title"><span>Luyện đề {html.escape(meta["level"])} '
            f'<span class="jp">{html.escape(meta["sach"])}</span> · <span class="jp">{html.escape(meta["hoi"])}</span></span>'
            f'<span class="p jp">{right}</span></div>')


def slide_cover(meta, total):
    return page(f'''{title_bar(meta, "LIVE")}
<div class="big" style="top:440px;font-size:40px;font-weight:800;color:var(--camdam)">LUYỆN ĐỀ JLPT CÙNG SENSEI</div>
<div class="big" style="top:520px;font-size:170px;font-weight:800;line-height:1">{html.escape(meta["level"])}</div>
<div class="big jp" style="top:720px;font-size:64px;font-weight:700;width:640px;right:auto;text-align:left;left:90px">{html.escape(meta["sach"])}</div>
<div style="position:absolute;top:840px;left:90px"><span class="pill jp" style="font-size:60px">{html.escape(meta["hoi"])}</span></div>
<div style="position:absolute;top:1010px;left:90px;width:640px;font-size:30px;font-weight:600;line-height:1.5">{total} câu · {html.escape(meta.get("thoi_gian","10 phút"))}<br>Nguồn: <span class="jp">{html.escape(meta.get("nguon",""))}</span></div>
''', "vay-chao")


def slide_rules(meta, total):
    return page(f'''{title_bar(meta, "LUẬT CHƠI")}
<div class="card" style="top:400px;right:90px;font-size:38px;font-weight:700;line-height:1.9;white-space:nowrap">
⏱ Mỗi câu 20–30 giây<br>💬 Comment <b style="color:var(--camdam)">1 số</b>: 1 · 2 · 3 · 4<br>✔ Hiện đáp án ngay sau mỗi câu<br>🏆 Đúng nhiều nhất được<br>&nbsp;&nbsp;&nbsp;&nbsp;vinh danh cuối live!</div>
''', "vay-chao")


def slide_mondai(meta, m, idx, nm):
    return page(f'''{title_bar(meta, f"{idx}/{nm}")}
<div style="position:absolute;top:420px;left:90px"><span class="pill jp" style="font-size:64px">{html.escape(m["ten"])}</span></div>
<div class="jp" style="position:absolute;top:580px;left:90px;font-size:44px;font-weight:700">{html.escape(m.get("dang",""))}</div>
<div class="card jp" style="top:680px;right:350px;font-size:38px;line-height:1.7;font-weight:500">{rich(m.get("yeu_cau",""))}</div>
''', "suy-nghi")


def slide_q(meta, m, q, reveal):
    n = len(m["cau_hoi"])
    long_opts = max(plain_len(o) for o in q["lua_chon"]) > 12
    ql = plain_len(q["cau"])
    qsize = q.get("co_chu", 72 if ql <= 6 else 52 if ql <= 22 else 46 if ql <= 34 else 40)
    osize = q.get("co_chu_lc", 46 if not long_opts else 38)
    opts = ""
    for i, o in enumerate(q["lua_chon"]):
        k = i + 1
        cls = ("ok" if k == q["dap_an"] else "dim") if reveal else ""
        opts += f'<div class="o {cls}" style="font-size:{osize}px"><b>{k}</b><span>{rich(o)}</span></div>'
    st = (f'<span class="t">✔ Đáp án {q["dap_an"]}</span>' if reveal
          else '<span class="t">⏱ 0:25</span>💬 Comment 1–4')
    if long_opts:  # 用法: câu dài -> lựa chọn full ngang, bỏ thanh trạng thái/Neko để nhường chỗ
        body = f'''{title_bar(meta, f"{m['ten']} · {q['so']}/{n}")}
<div class="q" style="height:200px"><div class="num">{q["so"]}</div><div class="qt jp" style="font-size:{qsize}px">{rich(q["cau"])}</div></div>
<div class="opts long jp" style="top:612px">{opts}</div>'''
        return page(body, None, cam=False)
    body = f'''{title_bar(meta, f"{m['ten']} · {q['so']}/{n}")}
<div class="q"><div class="num">{q["so"]}</div><div class="qt jp" style="font-size:{qsize}px">{rich(q["cau"])}</div></div>
<div class="opts jp">{opts}</div><div class="st">{st}</div>'''
    return page(body, "bien-dung" if reveal else "suy-nghi")


def slide_summary(meta, data):
    cells = "".join(
        f'<div class="cell"><small class="jp">{html.escape(m["ten"].replace("問題","問"))}-{q["so"]}</small><span>{q["dap_an"]}</span></div>'
        for m in data["mondai"] for q in m["cau_hoi"])
    return page(f'''{title_bar(meta, "ĐÁP ÁN")}
<div class="grid">{cells}</div>
<div class="st" style="top:1210px">🎯 Comment số câu đúng!</div>''', "cup-vang")


def slide_end(meta):
    lines = meta.get("ket_thuc") or ["Hẹn gặp lại buổi sau!"]
    return page(f'''{title_bar(meta, "HẸN GẶP LẠI")}
<div class="card" style="top:460px;right:350px;font-size:48px;font-weight:800;line-height:1.6">{"<br>".join(rich(x) for x in lines)}</div>''',
                "vay-chao")


def build(data, out):
    meta = data["meta"]
    mondai = data["mondai"]
    total = sum(len(m["cau_hoi"]) for m in mondai)
    pages = [slide_cover(meta, total), slide_rules(meta, total)]
    for i, m in enumerate(mondai, 1):
        pages.append(slide_mondai(meta, m, i, len(mondai)))
        for q in m["cau_hoi"]:
            pages += [slide_q(meta, m, q, False), slide_q(meta, m, q, True)]
    pages += [slide_summary(meta, data), slide_end(meta)]

    tmp = tempfile.mkdtemp()
    try:
        for i, h in enumerate(pages):
            with open(os.path.join(tmp, f"{i:03d}.html"), "w", encoding="utf-8") as f:
                f.write(h)
        subprocess.run(["node", os.path.join(HERE, "render.cjs"), tmp], check=True, cwd="/tmp")
        prs = Presentation()
        prs.slide_width, prs.slide_height = Emu(6858000), Emu(12192000)  # 7.5 x 13.333 in
        for i in range(len(pages)):
            s = prs.slides.add_slide(prs.slide_layouts[6])
            s.shapes.add_picture(os.path.join(tmp, f"{i:03d}.png"), 0, 0, prs.slide_width, prs.slide_height)
        prs.save(out)
        png_dir = os.path.splitext(out)[0] + "_png"
        if os.environ.get("KEEP_PNG"):
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
