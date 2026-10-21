import json
d=json.load(open('data.json'))
print('rows',len(d),'groups',len({r[1] for r in d}))
t=open('template.html').read()
open('index.html','w').write(t.replace('/*DATA*/',json.dumps(d,ensure_ascii=False)).replace('/*READ*/',json.dumps(json.load(open('readings.json')),ensure_ascii=False)))
