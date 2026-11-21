# Luyện 並べ替え（★）JLPT

Trang tĩnh để luyện dạng ngữ pháp sắp xếp câu của JLPT (N3, N2, N1). Học viên kéo thả thẻ vào ô trống. Chỉ cần đặt đúng thẻ vào ô ★, không bắt buộc xếp hết 4 ô.

## Mở trang
- Trên máy: nhấp đúp `index.html`, không cần server.
- Online: bật GitHub Pages cho repo, rồi mở `/jlpt-narabe/`.

## Tính năng
- Luồng: Chọn cấp độ → Thiết lập phiên → Luyện → Kết quả phiên.
- Thiết lập phiên: số câu (5/10/20/30/50/tất cả); nguồn câu (tất cả / theo kỳ / chưa làm / kho cần luyện lại); thứ tự (ngẫu nhiên / theo đề).
- Mỗi câu:
  - Kéo thả sắp xếp: không bắt buộc, chỉ để luyện.
  - Chọn đáp án ★: bắt buộc, chọn xong mới kiểm tra được và xem giải thích.
- Kho cần luyện lại:
  - Câu làm sai tự vào kho; học viên có thể tick 🔖 để tự lưu thêm câu.
  - Gỡ câu khỏi kho bằng nút ✕.
- Lịch sử: số câu đã làm, tỉ lệ đúng theo lượt, danh sách các phiên (thời gian, nguồn, số câu, đúng, tỉ lệ).
- Không đăng nhập vẫn luyện được: lịch sử lưu trên trình duyệt của máy đó.
- Đăng nhập (Google hoặc mã gửi qua email) để lưu tiến độ lên Google Sheet và dùng tiếp trên máy khác. Cách bật: xem `apps-script/HUONG_DAN.md`.

## Thêm dữ liệu N3 / N1
1. Soạn Google Doc đúng format như bản N2:
   ```
   Đề 07.2026
   Câu 1.2026.07
   <đề, có thể nhiều dòng, dùng ＿＿ và ★ cách nhau bằng dấu cách>
   1. ...
   2. ...
   3. ...
   4. ...
   Đáp án ★: 2
   Phân tích nhanh
   <các dòng phân tích>
   Thứ tự: ① → ③ → ② → ④. Đáp án ★: ②.
   Câu hoàn chỉnh: ...
   Dịch nghĩa: ...
   ```
2. Xuất text (File → Download → Plain text) thành `n1.txt`.
3. Chạy lệnh sau. Script tự kiểm tra: đủ 4 đáp án, thứ tự hợp lệ, vị trí ★ khớp với đáp án. Nếu có câu lỗi, script báo và dừng.
   ```bash
   python3 tools/parse_doc.py n1.txt N1 data
   ```
4. Tab N1 tự bật khi có file `data/n1.js`.

## Khung kênh cô Thuỳ và banner live
Sửa trong `config.js`, không cần động vào code:
- `social`: tên kênh, câu giới thiệu, link TikTok và Facebook. Hiện ở trang chọn cấp độ và cuối mỗi phiên luyện.
- `social.avatar`: ảnh cô Thuỳ (`assets/thuy-sensei.png`, cắt tròn 320×320).
- `live`: lịch live cố định theo tuần (`days`, `start`, `end`, giờ Việt Nam). Trong khung giờ live, nhãn đổi thành "ĐANG LIVE" và nút dẫn tới `url`; ngoài giờ, nút dẫn tới `urlOff`. Đặt `show: false` để tắt.
- Link ra kênh tự gắn `utm_source=luyen-narabe` và `utm_medium` theo vị trí (`home`, `ket-qua`, `live-home`, `live-setup`).
