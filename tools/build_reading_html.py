"""Xuất HTML bài đọc (dạng 4-1, 4-2) của DF-01 từ exports/DF-01_LMS_import.xlsx → exports/html/.
Mỗi bài 1 file, style inline để dán thẳng vào trình soạn thảo LMS. Chạy: python3 tools/build_reading_html.py"""
import openpyxl, os, re, html
os.makedirs('exports/html', exist_ok=True)
ws = openpyxl.load_workbook('exports/DF-01_LMS_import.xlsx').active
BOX = "max-width:560px;margin:12px auto;padding:20px 24px;border:1px solid #c9ccd1;border-radius:6px;background:#fff;color:#222;font-family:'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif;font-size:18px;line-height:1.9"
seen, parts = set(), []
for r in ws.iter_rows(min_row=2, values_only=True):
    tag, content = r[10], r[1] or ''
    if '━━━━━━ BÀI ĐỌC ━━━━━━' not in content: continue
    text = content.split('━━━━━━ BÀI ĐỌC ━━━━━━\n')[1].split('\n━')[0]
    if text in seen: continue
    seen.add(text)
    dang, code = tag.split('|')[1], tag.split('|')[-1]
    lines = [html.escape(l) for l in text.split('\n')]
    if dang == '4-1':  # tin nhắn / thư / nhật ký: văn bản liền
        body = ''.join(f'<p style="margin:0">{l}</p>' for l in lines)
    else:  # thông báo / bảng thông tin: tiêu đề + bảng + ghi chú
        rows, notes = [], []
        for l in lines[1:]:
            if l.startswith('※'): notes.append(l); continue
            k, v = (re.split(r'：|　', l, maxsplit=1) + [''])[:2]
            rows.append(f'<tr><td style="padding:6px 12px;border:1px solid #c9ccd1;background:#f3f4f6;white-space:nowrap">{k}</td><td style="padding:6px 12px;border:1px solid #c9ccd1">{v}</td></tr>')
        body = (f'<p style="margin:0 0 10px;text-align:center;font-weight:bold;font-size:20px">{lines[0]}</p>'
                f'<table style="border-collapse:collapse;width:100%">{"".join(rows)}</table>'
                + ''.join(f'<p style="margin:10px 0 0;font-size:16px">{n}</p>' for n in notes))
    snippet = f'<div style="{BOX}">{body}</div>'
    name = f'DF-01_{dang}_{code}.html'
    open('exports/html/' + name, 'w').write(snippet + '\n')
    parts.append(f'<h3 style="font-family:sans-serif">{name}</h3>{snippet}')
    print(name)
open('exports/html/DF-01_bai_doc_preview.html', 'w').write('<!doctype html><meta charset="utf-8"><title>DF-01 bài đọc</title><body style="background:#eef0f3;padding:16px">' + ''.join(parts) + '</body>\n')
