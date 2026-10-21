import json
d=json.load(open('data.json'))
print('rows',len(d),'groups',len({r[1] for r in d}))
t=open('template.html').read()
import base64
u=lambda f:'data:image/png;base64,'+base64.b64encode(open(f,'rb').read()).decode()
open('index.html','w').write(t.replace('/*DATA*/',json.dumps(d,ensure_ascii=False)).replace('/*TR*/',json.dumps(json.load(open('translations.json')),ensure_ascii=False)).replace('/*LOGOW*/',u('assets/logo-white.png')).replace('/*LOGO*/',u('assets/logo.png')).replace('/*READ*/',json.dumps(json.load(open('readings.json')),ensure_ascii=False)))
