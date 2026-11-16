"""Phân loại lại N3 sau khi người dùng lọc (đọc n3_user_filtered.json)."""
import json,csv,sys
v=json.load(open('grammar-clean/n3_user_filtered.json'))
H,rows=v[0],v[1:]
G=[
("Thời gian, trình tự, trạng thái đi kèm",[1,5,7,9,13,14,4,26,32]),
("Thể của động từ (tiếp diễn, hoàn thành, kinh nghiệm)",[2,6,8,16,17,18,19,20,21,22,3,135,168]),
("Động từ ghép",[23,24,25,27,28]),
("Nguyên nhân, lý do",[33,34,35,37,36,41,42,43]),
("Mục đích, công dụng",[39,38,44,45]),
("Điều kiện, giả định, nghịch tiếp",[47,49,50,52,58,51,48]),
("Suy đoán, truyền đạt",[60,61,62,63,65,66,67,68,70,71,64]),
("So sánh, mức độ, ví von, cảm thán, đánh giá",[81,75,76,125,126,74,145,194]),
("Đối tượng, lập trường, phạm vi",[77,85,86,112,78,79,80,84,90,91,108]),
("Giới hạn, nhấn mạnh, liệt kê",[82,87,93,94,103,88,89,98]),
("Trích dẫn, văn nói, văn viết",[113,114,115,118,116,117,119]),
("Ý chí, dự định, mong muốn, thay đổi",[146,147,129,148,131,132,133,193,134,150,151,128]),
("Khuyên bảo, nhờ vả, mệnh lệnh",[142,144,149,155,156,157,159,165,166,167]),
("Bị động, sai khiến, khả năng",[162,163,158,127]),
("Kính ngữ",[171,172,174,175,180,183,178,176,179,184,170,177,173,185,181,186]),
("Phó từ đi với phủ định",[187,188,189,190,191,192]),
]
by={int(r[0]):r for r in rows}
used=[s for _,l in G for s in l]
assert sorted(used)==sorted(by), (set(by)-set(used), set(used)-set(by), [s for s in used if used.count(s)>1])
out=[];n=0
for gi,(name,l) in enumerate(G,1):
    for s in l:
        n+=1; r=list(by[s])+['']*(8-len(by[s])); r[0]=str(n); r[1]=f"Nhóm {gi:02d} · {name}"; out.append(r[:8])
# cập nhật ghi chú tham chiếu số cũ
for r in out:
    if 'Aようになる (#133)' in r[7]:
        new=[x[0] for x in out if x[2]=='Aようになる'][0]; r[7]=r[7].replace('#133','#'+new)
D=json.load(open('grammar-clean/clean.json')); D['N3']=out
json.dump(D,open('grammar-clean/clean.json','w'),ensure_ascii=False,indent=0)
csv.writer(open(sys.argv[1],'w',newline='',encoding='utf-8')).writerows([H]+out)
from collections import Counter
for k,c in Counter(r[1] for r in out).items(): print(c,k)
print(len(out))
