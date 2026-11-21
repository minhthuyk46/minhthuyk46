# Luyện 並べ替え（★）JLPT

Trang tĩnh để luyện dạng ngữ pháp sắp xếp câu của JLPT (N3, N2, N1). Học viên kéo thả thẻ vào ô trống. Chỉ cần đặt đúng thẻ vào ô ★, không bắt buộc xếp hết 4 ô.

## Mở trang
- Trên máy: nhấp đúp `index.html`, không cần server.
- Online: bật GitHub Pages cho repo, rồi mở `/jlpt-narabe/`.

## Tính năng
- Kéo thả bằng chuột hoặc cảm ứng; hoặc chạm thẻ rồi chạm ô; hoặc phím 1–4.
- Chấm ô ★. Các ô khác nếu có đặt thẻ cũng được tô xanh (đúng) hoặc đỏ (sai).
- Sau khi kiểm tra, trang hiện: thứ tự đúng, câu hoàn chỉnh (đánh dấu cụm ★), phân tích từng bước, dịch nghĩa.
- Lọc theo kỳ thi. Có 4 chế độ: theo thứ tự / ngẫu nhiên / chỉ câu đã sai / chỉ câu chưa làm.
- Lịch sử làm bài lưu trên trình duyệt của từng học viên (localStorage).

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
