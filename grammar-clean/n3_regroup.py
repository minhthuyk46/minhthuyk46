"""Rà soát N3 nhóm 10 (gộp động từ kính ngữ đặc biệt) và nhóm 12 (bỏ mẫu kết hợp)."""
import json
P = 'grammar-clean/clean.json'
D = json.load(open(P))
rows = D['N3']
G10 = 'Nhóm 10 · Kính ngữ'
G12 = 'Nhóm 12 · Ngữ pháp bổ sung'
# STT gốc của các dòng chỉ là động từ kính ngữ đặc biệt -> gộp
MERGE = {'175','176','177','178','179','180','181','182','183','184','185','186','187','188','189','190'}
SONKEI = ["Động từ tôn kính đặc biệt (尊敬語)", "いらっしゃる・おっしゃる・なさる・ご覧になる・お見えになる・ご存じだ・くださる", "Động từ đặc biệt (thay thế động từ gốc)",
  "(Người trên) làm hành động – dùng động từ đặc biệt thay động từ gốc\n(tôn kính: nâng hành động của người trên)\nいらっしゃる（＝行く・来る・いる）\nおっしゃる（＝言う）\nなさる（＝する）\nご覧になる（＝見る）\nお見えになる（＝来る）\nご存じだ（＝知っている）\nくださる（＝くれる）",
  "先生は、今、研究室にいらっしゃいます。\n先生は、何とおっしゃいましたか。\nお飲み物は、何になさいますか。\nこの資料をご覧になりましたか。\n社長は、もうお見えになりました。\nこの方をご存じですか。\n先生が、私に本をくださった。", "",
  "Chủ ngữ: người trên/khách. Không dùng cho bản thân."]
KENJO = ["Động từ khiêm nhường đặc biệt (謙譲語・丁重語)", "おる・伺う・参る・いたす・申す・申し上げる・拝見する・お目にかかる・差し上げる・いただく・ございます", "Động từ đặc biệt (thay thế động từ gốc)",
  "(Tôi/phía mình) làm hành động – dùng động từ đặc biệt thay động từ gốc\n(khiêm nhường: hạ hành động của mình)\nおる（＝いる）\n伺う（＝聞く・訪ねる）\n参る（＝行く・来る）\nいたす（＝する）\n申す・申し上げる（＝言う）\n拝見する（＝見る）\nお目にかかる（＝会う）\n差し上げる（＝あげる）\nいただく（＝もらう・食べる・飲む）\nございます（＝ある; lịch sự, không dùng cho người）",
  "担当者は、ただいま席を外しております。\n一つ伺いたいことがあるのですが。\n明日、十時にそちらへ参ります。\n会場までご案内いたします。\n営業部の田中と申します。\n心よりお礼を申し上げます。\n先生の新しい本を拝見しました。\nまた先生にお目にかかりたいです。\n先生に、お土産を差し上げた。\n先生から本をいただきました。\nお手洗いは、二階にございます。", "",
  "Chủ ngữ: bản thân/người phía mình. ございます là 丁寧語, chủ ngữ là vật."]
KEEP12 = {
 '209': ["Aなくなる", "V-nai (bỏ i) + くなる", "Không còn A nữa\n(thay đổi trạng thái: trước A → giờ không A)", "夜食を食べなくなってから、体が軽くなった。", "", "Đối lập: Aようになる (#133)"],
 '223': ["Aても仕方がない・\nAてもしかたない", "V-te / V-nai (bỏ i) + くても + 仕方がない", "Có A thì cũng đành / Dù A cũng chẳng trách được\n（＝〜てもやむを得ない）", "時間がないから、全部読まなくても仕方がない。", "", "Chấp nhận tình huống không mong muốn."]}
out = []
for r in rows:
    s = r[0]
    if s in MERGE:
        if s == '175':
            out.append(['', G10] + SONKEI[0:1] and ['', G10, SONKEI[1], SONKEI[2], SONKEI[3], SONKEI[4], SONKEI[5], SONKEI[6]])
            out.append(['', G10, KENJO[1], KENJO[2], KENJO[3], KENJO[4], KENJO[5], KENJO[6]])
        continue
    if s == '191':
        r = [s, G10, 'Aていただく', 'V-te + いただく', 'Được (người trên) làm A cho\n(khiêm nhường của 〜てもらう)', '先生に推薦状を書いていただきました。', '', 'てもらうの謙譲語.']
    if s == '192':
        r = [s, G10, 'Aてくださる', 'V-te + くださる', '(Người trên) làm A cho tôi\n(tôn kính của 〜てくれる)', '先生が駅まで送ってくださいました。', '', 'てくれるの尊敬語.']
    if r[1].startswith('Nhóm 12'):
        if s not in KEEP12: continue
        k = KEEP12[s]; r = [s, G12, k[0], k[1], k[2], k[3], k[4], k[5]]
    out.append(list(r))
for i, r in enumerate(out, 1): r[0] = str(i)
D['N3'] = out
json.dump(D, open(P, 'w'), ensure_ascii=False, indent=0)
print(len(rows), '->', len(out))
