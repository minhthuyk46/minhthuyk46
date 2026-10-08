"""Sinh nội dung các sheet cho 'JFT Irodori – Hệ thống luyện thi' (v2, theo bản tiêu chuẩn 11 dạng).
Xuất JSON {sheet: rows} để ghi bằng Sheets API. Chạy: python3 tools/build_v2.py OUT_DIR"""
import json, sys

OUT = sys.argv[1]
SRC = {  # mã nguồn: (fileId, range A1 của dữ liệu cấp A1, tên file)
 'SRC_1-1': ('1FZN4hC_uGS3pH2n0xiSRZQNZjaq5zjEYsnZmQX-U6-4', "A1!A1:H", 'Danh sách từ vựng Mondai 1.1', 'A1'),
 'SRC_1-2': ('1cwbxYBLEaqOT9N2H53JU9vljhI7TnCt8C-QM-hN2QH0', "Từ vựng JFT!A1:Q", 'List từ vựng JFT Dạng 1-2', 'Từ vựng JFT'),
 'SRC_1-3': ('1SvuucwxzBUcwWES3fMnBXFWIGnrptUoQvK7YQ7K7Zjc', "Mondai 1.3!A2:I", 'Tổng hợp kanji_list theo Mondai 1-3 và 1-4', 'Mondai 1.3'),
 'SRC_1-4': ('1SvuucwxzBUcwWES3fMnBXFWIGnrptUoQvK7YQ7K7Zjc', "Mondai 1.4!A2:I", 'Tổng hợp kanji_list theo Mondai 1-3 và 1-4', 'Mondai 1.4'),
 'SRC_2-1': ('1h1jUHGiRlbynPR5AUbEkBZ28KPRDXGDsxTXYrnWDo3Q', "A1 - Nhập môn!A4:G", 'Phạm vi ngữ pháp JFT_Mondai 2-1', 'A1 - Nhập môn'),
 'SRC_2-2': ('1uSsHe66iAqiZSOa8lXE9VOZrcCxbDj6YlUIslAskD4Q', "Tong_Hop_Phan_Loai!A1:J", 'Tổng hợp Diễn đạt - Mondai 2-2', 'Tong_Hop_Phan_Loai'),
 'SRC_3': ('1h1ysdBEy6-pKs149vZUQL00nYZwYh6fP9P6FH74lIeE', "Can do nghe!A4:H", 'Cando Nghe cho dạng Mondai 3-1, 3-2, 3-3', 'Can do nghe'),
 'SRC_4': ('14eDik_ceUe6IiJrf-KagrwGyJq14qPGFyojSoTappSE', "A1 - Nhập môn!A4:H", 'Phân loại nguồn đọc_JFT_Mondai_4-1 4-2 theo bài Irodori', 'A1 - Nhập môn'),
}
DANG = [  # mã, tên, nhóm, trọng tâm, đơn vị, số PA, câu/đơn vị, nguồn, YC JP, YC VI, tình huống, nội dung, câu hỏi, lựa chọn, ảnh, audio, yêu cầu VI chuẩn, tiêu chí duyệt
 ('1-1','Dạng 1 Mondai 1-1','文字と語彙','Nhìn tranh chọn từ','1 hình + 1 câu hỏi',3,1,'SRC_1-1','JP','VI','—','Hình','Gộp trong yêu cầu','Từ JP','Bắt buộc (target_image)','Không','Nhìn hình và chọn một từ phù hợp nhất.','Tranh nhận diện được từ; không chữ lộ đáp án; 3 từ đúng hình thức; từ đích trong danh mục'),
 ('1-2','Dạng 2 Mondai 1-2','文字と語彙','Dùng từ theo ngữ cảnh','1 câu có chỗ trống',3,1,'SRC_1-2','JP','VI','—','Câu JP có chỗ trống','Gộp trong yêu cầu','Từ JP','Không','Không','Đọc câu và chọn từ phù hợp nhất để điền vào chỗ trống.','Câu đủ ngữ cảnh; chỉ một từ phù hợp; 3 lựa chọn; trọng tâm là cách dùng từ'),
 ('1-3','Dạng 3 Mondai 1-3','文字と語彙','Đọc từ chữ Hán','1 câu, 1 từ đánh dấu',3,1,'SRC_1-3','JP','VI','—','Câu JP, từ Hán đánh dấu','Gộp trong yêu cầu','Hiragana','Không','Không','Chọn cách đọc bằng hiragana đúng của từ được gạch chân.','Đúng từ Hán và cách đọc; đánh dấu rõ; không furigana từ đích; 3 cách đọc hiragana'),
 ('1-4','Dạng 4 Mondai 1-4','文字と語彙','Nghĩa/cách dùng từ chữ Hán','1 câu có chỗ trống',3,1,'SRC_1-4','JP','VI','—','Câu JP có chỗ trống','Gộp trong yêu cầu','Từ Hán + kana','Không','Không','Đọc câu và chọn từ viết bằng chữ Hán phù hợp nhất để điền vào chỗ trống.','3 từ Hán/kana; chia thể phù hợp; chỉ một từ đúng nghĩa trong câu'),
 ('2-1','Dạng 5 Mondai 2-1','会話と表現','Ngữ pháp trong hội thoại','1 hội thoại có chỗ trống',4,1,'SRC_2-1','JP','VI','VI khi cần bối cảnh','Hội thoại JP','Gộp trong yêu cầu','Dạng ngữ pháp JP','Tuỳ chọn (scene_image)','Không','Đọc hội thoại và chọn phương án phù hợp nhất để điền vào chỗ trống.','4 lựa chọn; mẫu Pick-up hoặc đáp ứng điều kiện; hội thoại đủ căn cứ; không biến thành lời đáp nghi thức'),
 ('2-2','Dạng 6 Mondai 2-2','会話と表現','Diễn đạt theo tình huống','1 hội thoại có chỗ trống',3,1,'SRC_2-2','—','VI','JP + VI','Hội thoại JP','Gộp trong yêu cầu','Lời nói/lời đáp JP','Tuỳ chọn','Không','Đọc hội thoại và chọn lời nói hoặc lời đáp phù hợp nhất để điền vào chỗ trống.','3 lựa chọn; tình huống Nhật–Việt; yêu cầu VI; lời đáp tự nhiên theo vai; hội thoại rõ người nói'),
 ('3-1','Dạng 7 Mondai 3-1','聴解','Nghe giao tiếp xã giao','1 audio hội thoại + 1 câu',3,1,'SRC_3','—','VI','VI','Audio JP','VI, đọc trước khi nghe','Tranh','Bắt buộc (option_image ×3)','Bắt buộc','(Câu hỏi VI theo từng bài)','Một hội thoại và một câu hỏi VI; 3 tranh; hai giọng rõ; đúng nhóm xã giao'),
 ('3-2','Dạng 8 Mondai 3-2','聴解','Nghe công cộng/cửa hàng','1 audio hội thoại + 1 câu',3,1,'SRC_3','—','VI','VI','Audio JP','VI, đọc trước khi nghe','Tranh','Bắt buộc (option_image ×3)','Bắt buộc','(Câu hỏi VI theo từng bài)','Một hội thoại và một câu hỏi VI; 3 tranh; điều kiện lựa chọn rõ; đúng nhóm công cộng/cửa hàng'),
 ('3-3','Dạng 9 Mondai 3-3','聴解','Nghe chỉ thị/thông báo','1 audio + 2 câu',3,2,'SRC_3','—','VI','VI','Audio JP dùng chung','VI, hai câu (1), (2)','Hai nhóm tranh','Bắt buộc (option_image ×6)','Bắt buộc','(Câu hỏi VI theo từng bài)','Một audio chung, hai câu hỏi VI; 3 tranh mỗi câu; hai căn cứ riêng; không hiện script'),
 ('4-1','Dạng 10 Mondai 4-1','読解','Hiểu nội dung văn bản','1 bài đọc + 2 câu',3,2,'SRC_4','—','VI','JP + VI','Bài đọc JP','JP','Cụm/câu JP','Tuỳ chọn','Không','Đọc bài và trả lời câu hỏi (1) và (2).','Một bài đọc, hai câu JP; 3 lựa chọn mỗi câu; hỏi hai nội dung khác nhau; bài đọc tách riêng'),
 ('4-2','Dạng 11 Mondai 4-2','読解','Tìm thông tin','1 bảng/tài liệu + 2 câu',3,2,'SRC_4','—','VI','JP + VI','Bảng/tài liệu JP','JP','Dữ liệu/cụm/câu JP','Bảng dựng bằng HTML, không dùng AI vẽ','Không','Đọc thông tin và trả lời câu hỏi (1) và (2).','Một bảng/tài liệu, hai câu JP; 3 lựa chọn mỗi câu; dữ liệu nhất quán; điều kiện đủ để tìm đúng thông tin'),
]
S = {}

S['00_HUONG_DAN'] = [
 ['HỆ THỐNG LUYỆN THI JFT-BASIC THEO IRODORI: CHECKLIST TRIỂN KHAI'],
 ['Làm lần lượt từ trên xuống. Đổi cột Trạng thái khi xong từng bước.'],
 [],
 ['Bước','Giai đoạn','Việc cần làm','Sheet','Người làm','Trạng thái','Ghi chú'],
 [1,'A. Kết nối nguồn','Mở từng sheet SRC_*, bấm vào ô A1 có báo lỗi #REF!, chọn "Allow access" (Cho phép truy cập). Làm 8 lần cho 8 sheet SRC.','SRC_1-1 … SRC_4','Người phụ trách','Chưa làm',''],
 [2,'A. Kết nối nguồn','Kiểm tra 04_MA_TRAN_PHU đã hiện số mục nguồn cho từng bài × dạng (không còn #REF!).','04_MA_TRAN_PHU','Người phụ trách','Chưa làm',''],
 [3,'A. Kết nối nguồn','Ghi ngày nhập và phiên bản nguồn vào 02_NGUON (cột "Ngày chốt snapshot").','02_NGUON','Người phụ trách','Chưa làm','Bản tiêu chuẩn mục 2.1: không coi snapshot là dữ liệu luôn cập nhật'],
 [4,'B. Chốt tiêu chuẩn','Duyệt 6 điểm đề xuất và 4 chênh lệch nguồn trong 90_QUYET_DINH, ghi quyết định + người chốt.','90_QUYET_DINH','Giám đốc / PTCM','Chưa làm','Chưa chốt thì chưa sản xuất hàng loạt'],
 [5,'B. Chốt tiêu chuẩn','Thử 8 điểm trình bày trên LMS bằng 1–2 câu thật, ghi kết quả vào 91_KIEM_THU_LMS.','91_KIEM_THU_LMS','PTCM + vận hành LMS','Chưa làm','Kiểm tra bằng tài khoản thí sinh'],
 [6,'B. Chốt tiêu chuẩn','Ở 04_MA_TRAN_PHU, cột "Bật?": tick những ô Bài × Dạng được phép ra đề.','04_MA_TRAN_PHU','PTCM','Chưa làm','Nguồn có mục ≠ tự động được ra đề'],
 [7,'B. Chốt tiêu chuẩn','Điền số câu từng dạng cho 12 đề tuần + 15 đề full trong 30_BLUEPRINT_DE.','30_BLUEPRINT_DE','PTCM','Chưa làm','Ghi rõ: cấu trúc bộ luyện của dự án, không phải quy định kỳ thi chính thức'],
 [8,'C. Đưa demo vào kho','Nhập 38 câu demo hiện có vào 20_NGAN_HANG (Pool = Luyện tập, Trạng thái = Demo cần chuẩn hoá).','20_NGAN_HANG, 21_NHOM_NGUON','GV/TG','Chưa làm','4-1, 4-2: bài đọc/bảng nhập ở 21_NHOM_NGUON'],
 [9,'D. Sản xuất','Tạo phiếu yêu cầu ở 10_YEU_CAU theo mẫu mục 7 của bản tiêu chuẩn. Trạng thái "Sẵn sàng sinh" khi đủ trường.','10_YEU_CAU','PTCM','Lặp lại',''],
 [10,'D. Sản xuất','Sinh bản nháp (Apps Script + ChatGPT/Claude, bước sau sẽ gắn). Câu mới luôn ở trạng thái Draft.','20_NGAN_HANG','GV/TG','Lặp lại',''],
 [11,'D. Sản xuất','QC VN rồi QC JP theo tiêu chí duyệt từng dạng (03_DANG_BAI cột cuối). Ghi Loại lỗi nếu trả về.','20_NGAN_HANG','GV Việt, GV Nhật','Lặp lại','Trả về ≥3 lần: cân nhắc loại câu'],
 [12,'D. Sản xuất','Tạo tranh/audio từ brief và script đã duyệt; đặt tên file bằng mã asset, không lộ đáp án.','20_NGAN_HANG, 21_NHOM_NGUON','GV/TG','Lặp lại','Script duyệt trước khi tạo giọng'],
 [13,'E. Ráp & phát hành','Ráp đề ở 31_RAP_DE theo blueprint; kiểm tra cột Cảnh báo không còn lỗi.','31_RAP_DE','PTCM','Lặp lại','Câu Pool Đề thi không dùng cho luyện tập'],
 [14,'E. Ráp & phát hành','Xuất file import LMS (Apps Script, bước sau sẽ gắn), thử 1 bài trước khi nhập hàng loạt.','—','Vận hành LMS','Lặp lại',''],
 [15,'F. Đo lường','Sau mỗi đợt thi: nhập p (tỉ lệ đúng) và D (độ phân biệt) cho từng câu; xem 40_THONG_KE.','20_NGAN_HANG, 40_THONG_KE','PTCM','Lặp lại','p 0,3–0,9; D ≥ 0,2'],
 [],
 ['QUY ƯỚC MÀU TIÊU ĐỀ'],
 ['Xanh dương nhạt','Trường bắt buộc'],
 ['Vàng','Trường gợi ý / nội dung câu'],
 ['Xanh lá','Tự động (công thức), không nhập tay'],
 ['Tím','Duyệt / QC'],
]

S['01_CAU_HINH'] = [
 ['Thông số','Giá trị','Ghi chú'],
 ['Phạm vi đợt hiện tại: Quyển','入門','Bản tiêu chuẩn: đợt demo = Irodori Nhập môn A1, bài 1–18'],
 ['Phạm vi đợt hiện tại: Bài từ',1,''],
 ['Phạm vi đợt hiện tại: Bài đến',18,''],
 ['Tiếng mẹ đẻ mặc định','vi',''],
 ['Phiên bản bản tiêu chuẩn','Bản duyệt 11 dạng (JFT_Tieu_chuan_11_dang_bai_Ban_duyet)',''],
 ['Ánh xạ cấp độ','入門 = A1 = "A1 - Nhập môn"; 初級1 = A2-1; 初級2 = A2-2','Các sheet SRC_2-1, SRC_4 đang lấy riêng sheet A1. Mở rộng A2 thì thêm SRC tương ứng.'],
]

S['02_NGUON'] = [['Mã nguồn','Dùng cho dạng','Tên file','Sheet nguồn','Link','Ngày chốt snapshot','Ghi chú']]
use = {'SRC_1-1':'1-1','SRC_1-2':'1-2','SRC_1-3':'1-3','SRC_1-4':'1-4','SRC_2-1':'2-1','SRC_2-2':'2-2','SRC_3':'3-1, 3-2, 3-3','SRC_4':'4-1, 4-2'}
for k,(fid,rng,name,sh) in SRC.items():
    S['02_NGUON'].append([k,use[k],name,sh,f'https://docs.google.com/spreadsheets/d/{fid}/edit','',''])
for k,(fid,rng,name,sh) in SRC.items():
    S[k] = [[f'=IMPORTRANGE("{fid}","{rng}")']]

S['03_DANG_BAI'] = [['Mã','Tên dạng','Nhóm','Trọng tâm','Đơn vị nội dung','Số lựa chọn','Số câu / đơn vị','Nguồn','Yêu cầu JP','Yêu cầu VI','Tình huống','Nội dung kiểm tra','Câu hỏi','Lựa chọn','Hình','Audio','Yêu cầu VI chuẩn','Tiêu chí duyệt bắt buộc']]
S['03_DANG_BAI'] += [list(d) for d in DANG]

# Ma trận phủ: bài 1..18 A1
hdr = ['Bài','1-1 Từ (tranh)','1-2 Từ vựng','1-3 Đọc Hán','1-4 Từ Hán','2-1 Ngữ pháp (Pick-up)','2-2 Diễn đạt','3-x Can-do nghe','4-1 Nguồn đọc','4-2 Nguồn thông tin']
M = [['Số mục nguồn theo bài (A1 – 入門). Số này chỉ cho biết có nguồn, không phải số câu.'], hdr]
for n in range(1,19):
    r = n+2
    M.append([n,
     f"=COUNTIF('SRC_1-1'!B:B,\"Bài \"&A{r})",
     f"=COUNTIFS('SRC_1-2'!J:J,\"入門\",'SRC_1-2'!K:K,A{r})",
     f"=COUNTIFS('SRC_1-3'!H:H,\"入門\",'SRC_1-3'!I:I,A{r})",
     f"=COUNTIFS('SRC_1-4'!H:H,\"入門\",'SRC_1-4'!I:I,A{r})",
     f"=COUNTIFS('SRC_2-1'!A:A,A{r},'SRC_2-1'!D:D,\"Pick-up\")",
     f"=COUNTIFS('SRC_2-2'!B:B,\"A1\",'SRC_2-2'!C:C,A{r})",
     f"=COUNTIFS('SRC_3'!C:C,\"入門*\",'SRC_3'!D:D,A{r})",
     f"=COUNTIFS('SRC_4'!A:A,A{r},'SRC_4'!F:F,\"4.1\")",
     f"=COUNTIFS('SRC_4'!A:A,A{r},'SRC_4'!F:F,\"4.2\")"])
M.append(['Tổng']+[f'=SUM({c}3:{c}20)' for c in 'BCDEFGHIJ'])
M += [[],['Bật ra đề? (tick khi PTCM đã duyệt ô Bài × Dạng)'],['Bài']+[d[0] for d in DANG]]
for n in range(1,19): M.append([n]+[False]*11)
S['04_MA_TRAN_PHU'] = M

S['10_YEU_CAU'] = [['Mã YC','Dạng','Pool','Mã đề (nếu có)','Quyển','Bài','Mục tiêu chính','Nguồn (file / sheet / hàng)','Tình huống & yêu cầu (ghi rõ ngôn ngữ)','Số đơn vị cần sinh','Ghi chú cho AI / người soạn','Người giao','Người làm','Deadline','Trạng thái','Số câu đã sinh','Số câu Approved'],
 ['YC-0001','2-2','Luyện tập','','入門',1,'Đáp lời khi đồng nghiệp về trước','SRC_2-2 / Tong_Hop_Phan_Loai / STT 1','Tình huống JP + VI; yêu cầu VI',1,'VÍ DỤ, xoá khi dùng thật','','','','Nháp',
  '=ARRAYFORMULA(IF(A2:A="",,COUNTIF(\'20_NGAN_HANG\'!C:C,A2:A)))','=ARRAYFORMULA(IF(A2:A="",,COUNTIFS(\'20_NGAN_HANG\'!C:C,A2:A,\'20_NGAN_HANG\'!AK:AK,"Approved")))']]

BANK = ['Mã câu','Mã nhóm (bài đọc/audio chung)','Mã YC','Dạng','Pool','Quyển','Bài','Mục tiêu','Nguồn (file/sheet/hàng)','Yêu cầu JP','Yêu cầu VI','Tình huống JP','Tình huống VI','Nội dung kiểm tra (câu/hội thoại; từ đích đặt trong 【】)','Câu hỏi','Số lựa chọn','Lựa chọn 1','Lựa chọn 2','Lựa chọn 3','Lựa chọn 4','Đáp án (số)','Lý do phương án nhiễu','Căn cứ đáp án','Giải thích VI','Brief hình','Mã asset hình','URL hình','Script audio (nhãn vai)','URL audio','Người soạn / công cụ','Biên soạn mới / chuyển thể','QC VN','Nhận xét VN','QC JP','Nhận xét JP','Loại lỗi','Trạng thái','p (tỉ lệ đúng)','D (độ phân biệt)','Số lần dùng','Phiên bản']
S['20_NGAN_HANG'] = [BANK, ['']*39 + ['=ARRAYFORMULA(IF(A2:A="",,COUNTIF(\'31_RAP_DE\'!C:C,A2:A)))','']]

S['21_NHOM_NGUON'] = [['Mã nhóm','Dạng','Loại','Tiêu đề','Nội dung JP (văn bản / HTML bảng)','Bản dịch VI (chỉ GV)','Script audio (chỉ GV)','URL audio','Mã asset hình','Nguồn','Trạng thái','Ghi chú']]

S['30_BLUEPRINT_DE'] = [['Mã đề','Loại','Tuần / thứ tự','Quyển','Bài từ','Bài đến']+[d[0] for d in DANG]+['Tổng câu','Ngày dùng dự kiến','Trạng thái','Ghi chú']]
for i in range(1,13): S['30_BLUEPRINT_DE'].append([f'DT-{i:02d}','Đề tuần',i,'入門',1,'']+['']*11+[f'=SUM(G{i+1}:Q{i+1})','','Chưa chốt',''])
for i in range(1,16):
    r=13+i
    S['30_BLUEPRINT_DE'].append([f'DF-{i:02d}','Đề full',i,'入門',1,18]+['']*11+[f'=SUM(G{r}:Q{r})','','Chưa chốt',''])

S['31_RAP_DE'] = [['Mã đề','STT','Mã câu','Dạng','Pool','Trạng thái câu','Cảnh báo'],
 ['','','','=ARRAYFORMULA(IF(C2:C="",,IFERROR(VLOOKUP(C2:C,{\'20_NGAN_HANG\'!A:A,\'20_NGAN_HANG\'!D:D},2,0),"Không tìm thấy")))',
  '=ARRAYFORMULA(IF(C2:C="",,IFERROR(VLOOKUP(C2:C,{\'20_NGAN_HANG\'!A:A,\'20_NGAN_HANG\'!E:E},2,0),)))',
  '=ARRAYFORMULA(IF(C2:C="",,IFERROR(VLOOKUP(C2:C,{\'20_NGAN_HANG\'!A:A,\'20_NGAN_HANG\'!AK:AK},2,0),)))',
  '=ARRAYFORMULA(IF(C2:C="",,IF(F2:F<>"Approved","Câu chưa Approved",IF(E2:E="Luyện tập","Câu thuộc Pool Luyện tập",IF(COUNTIFS(A2:A,A2:A,C2:C,C2:C)>1,"Trùng câu trong đề","OK")))))']]

ST = ['Draft','Demo cần chuẩn hoá','Đang QC VN','Đang QC JP','Trả về','Approved','Loại']
T = [['A. Ngân hàng câu theo dạng × trạng thái'],['Dạng']+ST+['Tổng','Luyện tập','Đề tuần','Đề full']]
for i,d in enumerate(DANG):
    r=i+3; B="'20_NGAN_HANG'!"
    T.append([d[0]]+[f'=COUNTIFS({B}$D:$D,$A{r},{B}$AK:$AK,{chr(66+j)}$2)' for j in range(len(ST))]+
             [f'=COUNTIF({B}$D:$D,$A{r})']+[f'=COUNTIFS({B}$D:$D,$A{r},{B}$E:$E,{c}$2)' for c in 'JKL'])
T += [[],['B. Đủ / thiếu câu Approved cho 1 mã đề'],['Nhập mã đề:','DT-01'],['Dạng','Cần (blueprint)','Approved đúng Pool','Thiếu']]
for i,d in enumerate(DANG):
    r=18+i
    T.append([d[0],f"=IFERROR(INDEX('30_BLUEPRINT_DE'!$G:$Q,MATCH($B$16,'30_BLUEPRINT_DE'!$A:$A,0),MATCH(A{r}&\"\",'30_BLUEPRINT_DE'!$G$1:$Q$1,0)),0)",
              f"=COUNTIFS('20_NGAN_HANG'!$D:$D,A{r},'20_NGAN_HANG'!$AK:$AK,\"Approved\",'20_NGAN_HANG'!$E:$E,IF(LEFT($B$16,2)=\"DT\",\"Đề tuần\",\"Đề full\"))",
              f'=MAX(0,N(B{r})-C{r})'])
S['40_THONG_KE'] = T

S['90_QUYET_DINH'] = [['Mã','Loại','Nội dung cần chốt','Đề xuất trong bản tiêu chuẩn','Quyết định','Người chốt','Ngày','Ghi chú'],
 ['QD-01','Đề xuất §9','Ngôn ngữ yêu cầu','Song ngữ JP–VI cho nhóm 1 và 2-1; chỉ VI cho 2-2, nghe, đọc','','','',''],
 ['QD-02','Đề xuất §9','Tình huống 2-1','Bổ sung VI theo ảnh mẫu khi cần','','','',''],
 ['QD-03','Đề xuất §9','Bố cục 2-2','Ưu tiên bong bóng hội thoại; cho phép A/B xuống dòng nếu LMS giới hạn','','','',''],
 ['QD-04','Đề xuất §9','Nghe: số lượt nghe ở chế độ mô phỏng','Tình huống và câu hỏi đọc trước bằng VI; chưa chốt số lượt nghe','','','',''],
 ['QD-05','Đề xuất §9','Quy mô 3-3','Tính theo số bài nghe, mỗi bài 2 câu','','','',''],
 ['QD-06','Đề xuất §9','Cách gắn 3 tranh lựa chọn','Thử LMS rồi chốt (xem 91_KIEM_THU_LMS)','','','',''],
 ['CL-01','Chênh lệch nguồn §2.4','Tổng 1-1: 271 (khung năng lực) vs 273 (sheet cấu trúc); chữ Hán 419 vs 429','Đối chiếu cách đếm, phạm vi, phiên bản','','','',''],
 ['CL-02','Chênh lệch nguồn §2.4','Từ vựng "khoảng 12 câu" vs 4+3+3+3','Chỉ là số tham khảo, không phải cấu hình bắt buộc','','','',''],
 ['CL-03','Chênh lệch nguồn §2.4','A1 bài 3 thuộc 4-2 vs Khung chương trình ghi tin nhắn tại A1 bài 1','Không hợp nhất tự động','','','',''],
 ['CL-04','Chênh lệch nguồn §2.4','Một số dòng 2-2 ghi "chọn ngữ pháp"','Trường chuẩn hoá dùng "cách diễn đạt phù hợp tình huống", giữ nhãn nguồn','','','',''],
]
S['91_KIEM_THU_LMS'] = [['Điểm cần kiểm chứng','Cách xử lý dự phòng (theo bản tiêu chuẩn)','Đã thử?','Kết quả','Người thử','Ngày','Ảnh chụp / link']] + [[a,b,False,'','','',''] for a,b in [
 ('Option có hỗ trợ ảnh hoặc HTML không','Giữ bộ tranh riêng để gắn thủ công nếu form không hỗ trợ'),
 ('Content có giữ HTML, gạch chân, ruby không','Xuất văn bản an toàn; duy trì bản HTML duyệt riêng'),
 ('Vùng thông tin chung có giữ bảng khi copy không','Tạo HTML và bản xem trước; thử một bài trước khi nhập hàng loạt'),
 ('Audio dùng chung cho hai câu có được giữ không','Giữ một audio chung và liên kết đúng hai câu hỏi'),
 ('URL ảnh/audio có bị chặn truy cập không','Kiểm tra bằng phiên thí sinh, không chỉ phiên quản trị'),
 ('Số lượt nghe, tua, tự phát','Khai báo trong cấu hình chế độ luyện/mô phỏng'),
 ('Giải thích hiện lúc nào','Cấu hình sau nộp hoặc theo chế độ học; mặc định ẩn khi đang thi'),
 ('Font Nhật và bố cục điện thoại','Xem trước trên thiết bị thực tế, đặc biệt bảng và tranh ngang')]]

S['99_DANH_MUC'] = [['Dạng','Pool','Trạng thái câu','Trạng thái YC','Loại lỗi','Quyển','QC','Loại nhóm','Trạng thái bước']]
cols = [[d[0] for d in DANG],['Luyện tập','Đề tuần','Đề full'],ST,['Nháp','Sẵn sàng sinh','Đã sinh','Huỷ'],
 ['Ngoài phạm vi','2 đáp án đúng','JP không tự nhiên','Nhiễu yếu','Lộ đáp án','Sai ngôn ngữ hiển thị','Tranh mơ hồ','Audio lỗi','Khác'],
 ['入門','初級1','初級2'],['Đạt','Sửa','Loại'],['Bài đọc','Bảng/tài liệu','Audio'],['Chưa làm','Đang làm','Xong','Lặp lại']]
for i in range(max(map(len,cols))):
    S['99_DANH_MUC'].append([c[i] if i<len(c) else '' for c in cols])
import re as _re
for k,v in S.items():
    for r in v:
        for i,c in enumerate(r):
            if isinstance(c,str) and _re.fullmatch(r'\d-\d', c): r[i]="'"+c
json.dump(S, open(OUT+'/v2.json','w'), ensure_ascii=False)
for k,v in S.items(): print(k, len(v), max(len(r) for r in v))
