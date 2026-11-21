"""Tạo bản trang để xuất bản lên claude.ai (bỏ các thẻ khung html/head/body vì nền tảng tự bọc).
Dùng: python3 tools/build_artifact.py <thư mục ra>"""
import re,sys,os,shutil
src=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));out=sys.argv[1]
os.makedirs(out,exist_ok=True)
h=open(os.path.join(src,'index.html'),encoding='utf-8').read()
h=re.sub(r'<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*','',h,flags=re.I)
h=re.sub(r'<meta charset="utf-8">\s*|<meta name="viewport"[^>]*>\s*','',h)
open(os.path.join(out,'index.html'),'w',encoding='utf-8').write(h)
for f in ['config.js','sync.js','data/n1.js','data/n2.js','data/n3.js','assets/logo-ngang.png','assets/logo-ngang-trang.png','assets/thuy-sensei.png']:
  os.makedirs(os.path.dirname(os.path.join(out,f)) or out,exist_ok=True);shutil.copy(os.path.join(src,f),os.path.join(out,f))
print('ok',out)
