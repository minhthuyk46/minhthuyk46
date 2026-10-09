# JFT-Basic Exam Generator — phạm vi いろどり (v2)

Hệ thống tạo câu luyện thi JFT-Basic (đầu ra A2) theo 11 dạng bài, phạm vi いろどり A1 · A2-1 · A2-2 (54 bài).
Quản lý trên **Google Sheet**, chạy tự động bằng **Apps Script** + **ChatGPT / Claude API**, việc khó làm bằng **Claude Code**.

## Luồng 9 khâu

| Khâu | Đầu vào → Đầu ra | Công cụ | Ai |
|---|---|---|---|
| 1. Lập phiếu | ô đã tick ở `04` → phiếu "Sẵn sàng sinh" ở `10_YEU_CAU` | Sheet / Claude Code | PTCM |
| 2. Sinh câu | phiếu → câu **Draft** ở `20_NGAN_HANG` | Menu 🎌 JFT › 1 (ChatGPT/Claude) | Bot |
| 3. Tự kiểm tra | Draft → **Đang QC VN** / **Trả về** | Menu › 2 (luật cứng) | Bot |
| 4. QC VN | cột QC VN = Đạt/Sửa/Loại → Menu › 3 | Sheet | GV Việt |
| 5. QC JP | cột QC JP = Đạt/Sửa/Loại → Menu › 3 → **Approved** | Sheet | GV Nhật |
| 6. Sửa trả về | Trả về → Draft | Sheet / Claude Code | Người soạn |
| 7. Audio + tranh | Script → Google TTS → `URL audio`; Brief → SVG/PNG → `URL hình` | Menu › 4 / Claude Code | Bot + TG |
| 8. Ráp đề | Mã đề + mã câu ở `31_RAP_DE` | Sheet | PTCM |
| 9. Xuất LMS | mã đề (DT-01) hoặc bài luyện (A1-05) → `.xlsx` "MULTIPLE CHOICE (Advanced)" | Menu › 5 | Vận hành LMS |

Bảng điều phối: sheet `05_LUONG_TU_DONG` (đếm việc đang chờ từng khâu). Nhật ký chạy: `06_NHAT_KY`.

## Cài đặt (1 lần, ~10 phút)

1. Mở Google Sheet → **Extensions › Apps Script**.
2. Xoá nội dung cũ, dán `apps-script/Code.gs`. Project Settings › tick *Show appsscript.json* → dán `apps-script/appsscript.json`.
3. Project Settings › **Script Properties** → thêm khoá theo bảng ở `05_LUONG_TU_DONG` (A25:D34):
   `AI_PROVIDER` (openai | claude), `OPENAI_API_KEY` hoặc `CLAUDE_API_KEY`, `GCP_TTS_API_KEY`, `DRIVE_FOLDER_ID`.
4. Lưu → tải lại Sheet → menu **🎌 JFT** xuất hiện → chạy thử 1 mục → cấp quyền.

> Không dán API key vào sheet hay gửi qua chat.

## Luật nội dung chính
- **QD-12**: luyện bài N chỉ dùng tình huống bài N, từ vựng/ngữ pháp bài 1→N.
- **QD-01**: nhóm 1 và 2-1 yêu cầu song ngữ (VI trước, JP sau); còn lại chỉ VI.
- **QD-04/06**: nghe 1 lần; tình huống + câu hỏi VI hiện trên đề; 3 tranh đánh số 1/2/3.
- Câu do AI sinh **luôn là Draft** — phải qua tự kiểm tra + QC VN + QC JP.

## Giới hạn
- Apps Script tối đa 6 phút/lần chạy → script tự dừng ở ~4,5–5 phút; bấm lại menu để chạy tiếp.
- Link Drive cho audio/hình: nếu LMS không phát được, upload lên kho media LMS rồi thay URL.
- Tranh minh hoạ chưa tự động trong Apps Script: dùng Claude Code (`tools/svg2png.mjs`).
