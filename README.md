# JFT-Basic Exam Generator — phạm vi いろどり (v3)

Hệ thống tạo câu luyện thi JFT-Basic (đầu ra A2) theo 11 dạng bài, phạm vi いろどり A1 · A2-1 · A2-2 (54 bài).
Quản lý trên **Google Sheet**, **Apps Script** điều phối, **ChatGPT Plus/Pro** soạn câu và vẽ tranh, **Gemini TTS** (miễn phí) đọc audio, **Claude** viết code và rà chất lượng. Không gọi API trả phí.

## Luồng (v3 – theo flow "Google Sheet + Apps Script + ChatGPT + Claude", không API trả phí)

| Khâu | Đầu vào → Đầu ra | Công cụ | Ai |
|---|---|---|---|
| 1. Kế hoạch → phiếu | đợt ở `07_KE_HOACH` (Duyệt kế hoạch) → Menu 0 → phiếu **Chờ tạo** | Apps Script | PTCM |
| 2. Soạn brief | Chờ tạo → **Chờ sản xuất** (prompt `08_PROMPT` + mục nguồn bài + ngữ liệu `15` + kho hình `09` + câu đã có + khuôn JSON) | Apps Script (5 phút/lần) | Bot |
| 3. Viết câu | đọc ô Brief → dán JSON vào ô Kết quả | ChatGPT Plus/Pro (Agent 6:00 hoặc copy tay) | ChatGPT |
| 4. Nhận + kiểm tra | JSON hỏng → cột Lỗi; câu đúng → `20_NGAN_HANG` **Chờ duyệt** + tự vào tab `11_DUYET`; thiếu → lượt sau | Apps Script (ngay khi dán) | Bot |
| 5. Duyệt (1 người) | tab `11_DUYET`: cột DUYỆT = Đạt / Cần sửa (+ nhận xét) / Loại | Sheet | Người duyệt duy nhất |
| 7. Vòng sửa | Cần sửa → Brief sửa → ChatGPT dán Kết quả sửa → Chờ duyệt (v+1) | Apps Script + ChatGPT | Bot |
| 8. Hình + audio | hình Irodori `H001.png` / tranh ChatGPT vẽ `JQ-xxxx.png` → folder kho_hinh → tự gắn; audio Gemini TTS miễn phí | ChatGPT · Gemini | TG + Bot |
| 9. Xuất LMS | mã đề / bài luyện `A1-05` / mã phiếu → `.xlsx` "MULTIPLE CHOICE (Advanced)" | Apps Script | Vận hành LMS |

Hướng dẫn ChatGPT Project, Agent hẹn giờ, làm tay, tranh, audio: [`docs/ChatGPT_Project_JFT.md`](docs/ChatGPT_Project_JFT.md).
Chạy thử toàn vòng bằng mô phỏng: `node tools/sim/run.cjs` (13 bước).

## Cài đặt (1 lần, ~10 phút)

1. Mở Google Sheet → **Extensions › Apps Script**.
2. Xoá nội dung cũ, dán `apps-script/Code.gs`. Project Settings › tick *Show appsscript.json* → dán `apps-script/appsscript.json`.
3. Project Settings › **Script Properties**: `DRIVE_FOLDER_ID` (bắt buộc), `GEMINI_API_KEY` (audio, key miễn phí, không bật thanh toán).
4. Lưu → tải lại Sheet → menu **🎌 JFT › ⚙ Cài đặt** (cấp quyền) → **⏱ Bật chạy tự động**.
5. Cài ChatGPT Project + Agent 6:00 theo `docs/ChatGPT_Project_JFT.md`.

> Không dán API key vào sheet hay gửi qua chat.

## Luật nội dung chính
- **QD-12**: luyện bài N chỉ dùng tình huống bài N, từ vựng/ngữ pháp bài 1→N.
- **QD-01**: nhóm 1 và 2-1 yêu cầu song ngữ (VI trước, JP sau); còn lại chỉ VI.
- **QD-04/06**: nghe 1 lần; tình huống + câu hỏi VI hiện trên đề; 3 tranh đánh số 1/2/3.
- Câu do AI viết luôn vào **Chờ duyệt** (tab `11_DUYET`, 1 người duyệt) — chỉ câu **Đạt** mới được xuất.

## Giới hạn
- Apps Script tối đa 6 phút/lần chạy → script tự dừng ở ~4,5–5 phút; bấm lại menu để chạy tiếp.
- Link Drive cho audio/hình: nếu LMS không phát được, upload lên kho media LMS rồi thay URL.
- Tranh minh hoạ chưa tự động trong Apps Script: dùng Claude Code (`tools/svg2png.mjs`).
