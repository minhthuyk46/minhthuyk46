"""Chuyển text đề 並べ替え (xuất từ Google Doc) sang JSON + JS cho trang luyện.
Dùng: python3 parse_doc.py <file.txt> <LEVEL> <out_dir>
"""
import re,json,sys,os
LV=sys.argv[2]
L=open(sys.argv[1]).read().split('\n')
qs=[];cur=None;st=None
C='①②③④'
for line in L:
  s=line.strip()
  m=re.match(r'^Câu\s+(\d+)\.(\d{4})\.(\d{2})',s)
  if m:
    cur={'id':f'{LV}-{m[2]}{m[3]}-{m[1]}','level':LV,'exam':f'{m[2]}-{m[3]}','no':int(m[1]),'stem':[],'options':[],'star':None,'order':None,'full':[],'trans':'','explain':[],'note':[]};qs.append(cur);st='stem';continue
  if re.match(r'^Đề\s+\d',s): st=None;continue
  if not cur or not s or st is None: continue
  m=re.match(r'^([1-4])\.\s*(.+)$',s)
  if st in('stem','opt') and m and len(cur['options'])<4: cur['options'].append(m[2]);st='opt';continue
  if st=='stem': cur['stem'].append(s);continue
  m=re.match(r'^Đáp án ★:\s*([1-4])',s)
  if m: cur['star']=int(m[1]);st='exp';continue
  if s=='Phân tích nhanh': continue
  if s.startswith('Câu hoàn chỉnh:'): cur['full'].append(s.split(':',1)[1].strip());st='full';continue
  if s.startswith('Dịch nghĩa:'): cur['trans']=s.split(':',1)[1].strip();st='after';continue
  if st=='full': cur['full'].append(s);continue
  if st=='after': cur['note'].append(s);continue
  m=re.match(r'^Thứ tự:\s*(.+?)\.\s*Đáp án',s)
  if m: cur['order']=[C.index(c)+1 for c in m[1] if c in C];continue
  cur['explain'].append(s)
bad=[]
for q in qs:
  stem='\n'.join(q['stem'])
  toks=re.findall(r'＿＿|★',stem)
  pos=toks.index('★') if '★' in toks else -1
  q['starPos']=pos
  ok=len(q['options'])==4 and q['order'] and sorted(q['order'])==[1,2,3,4] and len(toks)==4 and q['order'][pos]==q['star']
  if not ok: bad.append((q['id'],toks,q['order'],q['star'],len(q['options'])))
print(len(qs),'bad',len(bad));[print(b) for b in bad]
for q in qs: q.pop('note',None)
out=sys.argv[3]
json.dump(qs,open(os.path.join(out,LV.lower()+'.json'),'w'),ensure_ascii=False,indent=1)
open(os.path.join(out,LV.lower()+'.js'),'w').write('window.NARABE=window.NARABE||{};window.NARABE.'+LV+'='+json.dumps(qs,ensure_ascii=False)+';\n')
if bad: sys.exit('Có câu lỗi, kiểm tra lại data gốc.')
