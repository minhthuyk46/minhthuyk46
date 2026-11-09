import json
d=json.load(open('levels.json'))
print({k:len(v) for k,v in d.items()})
t=open('template.html').read()
import base64
u=lambda f:'data:image/png;base64,'+base64.b64encode(open(f,'rb').read()).decode()
open('index.html','w').write(t.replace('/*DATA*/',json.dumps(d,ensure_ascii=False)).replace('/*TR*/',json.dumps({'N1':json.load(open('translations.json'))},ensure_ascii=False)).replace('/*LOGOW*/',u('assets/logo-white.png')).replace('/*LOGO*/',u('assets/logo.png')).replace('/*READ*/',json.dumps(json.load(open('readings_levels.json')),ensure_ascii=False)))
