---
name: jft-sinh-de
description: Sinh câu hỏi JFT-Basic theo dạng bài, giới hạn trong phạm vi giáo trình いろどり, ghi thẳng vào sheet QUESTION_BANK. Dùng khi người dùng nói "sinh câu JFT", "làm đề JFT dạng ...", "bổ sung ngân hàng câu hỏi Irodori", "kiểm tra câu JFT".
---

# Sinh câu hỏi JFT từ phạm vi Irodori

## Input cần có (hỏi nếu thiếu)
- Link Google Sheet (đã chạy menu "0. Khởi tạo cấu trúc sheet")
- Dạng bài (cột Type trong BLUEPRINT), số câu, phạm vi quyển + bài

## Quy trình
1. Đọc `SYLLABUS_IRODORI` (Google Sheets connector) → lọc đúng quyển/bài. KHÔNG dùng từ/kanji/ngữ pháp ngoài phạm vi.
2. Đọc `QUESTION_BANK` cùng Type để tránh trùng Stem/ngữ cảnh.
3. Soạn câu theo đúng quy tắc trong `SYSTEM_PROMPT` của `apps-script/Code.gs`:
   - 4 lựa chọn, 1 đáp án; đáp án phân bố đều A–D
   - Phương án nhiễu có chủ đích (trợ từ, âm đọc kanji, từ gần nghĩa)
   - Nghe hiểu: `Script` dạng `F: … / M: … / N: …`, mỗi lượt 1 dòng
   - Cần hình: `ImagePrompt` tiếng Anh, line-art, ghi rõ chữ xuất hiện trong hình
   - `Explanation_VI`: vì sao đúng + vì sao từng phương án sai
4. Tự QC trước khi ghi: ngữ pháp/trợ từ chuẩn, không có 2 đáp án cùng đúng, độ dài các phương án tương đương, không lộ đáp án qua hình thức.
5. Append vào `QUESTION_BANK` đúng thứ tự cột: ID, Section, Type, Book, Lesson, Stem, Script, OptionA–D, Answer, Explanation_VI, ImagePrompt, ImageURL(trống), AudioURL(trống), Status=`Draft`, CreatedAt.
6. Báo lại: số câu đã ghi + bảng tóm tắt (ID | Bài | Đáp án | Điểm nhiễu chính).
