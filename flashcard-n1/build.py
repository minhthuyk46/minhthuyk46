import json,re,sys
d=json.load(open('data.json'))
t=open('template.html').read()
ids=set(re.findall(r'"([0-9+]+)"',t.split('const GROUPS=')[1].split('];')[0]))
print('rows',len(d),'missing',[r[0] for r in d if r[0] not in ids],'extra',ids-{r[0] for r in d})
open('index.html','w').write(t.replace('/*DATA*/',json.dumps(d,ensure_ascii=False)))
