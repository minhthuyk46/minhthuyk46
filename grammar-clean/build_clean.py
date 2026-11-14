"""Tạo dữ liệu sạch N1/N2/N3 theo chuẩn chung.
Cột: STT | Phân loại | Mẫu câu | Cách chia | Ý nghĩa | Ví dụ | Dịch ví dụ | Lưu ý
- Ý nghĩa: giữ nguyên dòng đỏ (chuẩn) của N1/N2; dòng chưa chuẩn lấy từ n1_rewrite / n3_rewrite.
- Cách chia: thống nhất ký hiệu V-ru, V-ta, V-te, V-nai, V-masu (bỏ masu), V-ou, Ai-い, Ana-な, N-の, TTT.
"""
import json, re
L = json.load(open('flashcard-n1/levels.json'))
TR = json.load(open('flashcard-n1/translations.json'))
RW = {'N1': json.load(open('grammar-clean/n1_rewrite.json')), 'N2': {}, 'N3': json.load(open('grammar-clean/n3_rewrite.json'))}
VI = re.compile(r'[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]', re.I)
KANA = re.compile(r'[぀-ヿ一-鿿]')

def is_vi(l): return bool(VI.search(l)) and not KANA.search(l[:6])

SUBS = [
 (r'V-masu \(bỏ ます\)|V-masu \(bỏ masu\)|V-bỏ masu|V-bỏ ます|V-masu  ?\(bỏ masu\)|Vます bỏ ます|V2-masu', 'V-masu (bỏ masu)'),
 (r'V-nai \(bỏ ない\)', 'V-nai (bỏ nai)'), (r'V-nai \(bỏ い\)', 'V-nai (bỏ i)'),
 (r'V普通形|普通形', 'TTT'), (r'V意向形|V-よう \(Thể ý chí\)|V-you \(thể ý chí\)|V-ou \(thể ý chí\)|V-yoo|V-ý chí|V-よう', 'V-ou'),
 (r'V可能形|V可能|V-khả năng|Thể khả năng', 'V-khả năng'), (r'V受身形', 'V-bị động'), (r'V使役受身形', 'V-sai khiến bị động'), (r'V使役形', 'V-sai khiến'),
 (r'V命令形', 'V-mệnh lệnh'), (r'Vる', 'V-ru'), (r'Vた', 'V-ta'), (r'Vて', 'V-te'), (r'Vで', 'V-de'), (r'Vない', 'V-nai'), (r'Vると', 'V-ru と'), (r'Vたら', 'V-ta ら'),
 (r'Adj-i|Ai-い|Ai\b|Aい', 'Ai-い'), (r'Adj-na|Ana-な|An-な|Anな|Ana\b|Aな', 'Ana-な'), (r'Nの', 'N-の'), (r'N-no', 'N-の'),
 (r'＋', ' + '), (r'／', ' / '), (r' {2,}', ' '),
]
def norm_form(s):
    for a, b in SUBS: s = re.sub(a, b, s)
    s = re.sub(r'/\s*/', '/', s); s = re.sub(r'(\S)\+ ', r'\1 + ', s); s = re.sub(r' \+(\S)', r' + \1', s); s = re.sub(r'\n\s*/\s*', '\n', s)
    s = re.sub(r'Ai-い-い', 'Ai-い', s); s = re.sub(r'Ana-な-な', 'Ana-な', s)
    for a, b in [('Ana-な -である','Ana-である'),('Ana-な-である','Ana-である'),('Ana-な + な','Ana-な'),('Ai-い-くて','Ai-くて'),('Ai-いくて','Ai-くて'),('Ana-な-で','Ana-で'),('Ana-な-だ','Ana-だ'),('Ana-なだ','Ana-だ'),('Ai-い-くない','Ai-くない'),('Ai-い-く','Ai-く'),('Ai-い (bỏ い)','Ai (bỏ い)'),('V-ruと','V-ru + と'),('V-taら','V-ta + ら'),('V-teいる','V-te + いる'),('V-teiru','V-te + いる'),('Na-だ','Ana-だ'),('Aiい','Ai-い'),('Ai-い い','Ai-い'),('V-sai khiếnて','V-sai khiến (て)'),('V-sai khiếnの意向形','V-sai khiến (thể ý chí)'),('V-bị độngて','V-bị động (て)'),('Ana-な (bỏ だ)','Ana (bỏ だ)'),('Ana-な bỏ だ','Ana bỏ だ'),('N+を','N + を'),('N+に','N + に')]:
        s = s.replace(a, b)
    return '\n'.join(x.strip() for x in s.split('\n')).strip()

def split_ex(s, lv, stt):
    lines = [l.strip() for l in s.split('\n') if l.strip()]
    tr = list(TR.get(stt, [])) if lv == 'N1' else []
    ja, vi = [], []
    for i, l in enumerate(lines):
        if is_vi(l): vi.append(l); continue
        ja.append(l)
        if lv == 'N1' and not (i + 1 < len(lines) and is_vi(lines[i + 1])) and not re.match(r'^【.*】$', l) and tr:
            vi.append(tr.pop(0))
    return '\n'.join(ja), '\n'.join(vi)

def clean_pat(s): return re.sub(r'・\s*\n', '・\n', s.strip())

out = {}
for lv, rows in L.items():
    res = []
    for r in rows:
        stt, grp, pat, form, mean, ex, note = (r + [''] * 7)[:7]
        mean = RW[lv].get(stt, mean).strip()
        ja, vi = split_ex(ex, lv, stt)
        res.append([stt, grp, clean_pat(pat), norm_form(form), mean, ja, vi, note.strip()])
    out[lv] = res
json.dump(out, open('grammar-clean/clean.json', 'w'), ensure_ascii=False, indent=0)
for lv, v in out.items(): print(lv, len(v))
