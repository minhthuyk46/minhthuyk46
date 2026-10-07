# JFT-Basic Exam Generator — phạm vi いろどり

Hệ thống sinh đề JFT-Basic **theo từng dạng bài**, giới hạn từ vựng/kanji/ngữ pháp trong giáo trình **いろどり 生活の日本語** (入門 · 初級1 · 初級2), kèm **audio tiếng Nhật tự nhiên** và **hình minh hoạ**.

## Kiến trúc

| Thành phần | Vai trò |
|---|---|
| **Google Sheet** | Kho dữ liệu: phạm vi Irodori, blueprint dạng bài, ngân hàng câu hỏi, log đề |
| **Apps Script** (`apps-script/Code.gs`) | Menu 1 click: sinh câu → audio → hình → xuất file import LMS |
| **Claude API** | Sinh câu hỏi + giải thích tiếng Việt, vẽ hình minh hoạ dạng SVG line-art |
| **Google Cloud TTS** (Neural2 / Chirp3-HD) | Giọng Nhật tự nhiên, tách giọng nam/nữ theo nhãn `F:` / `M:` |
| **Claude Code** (`.claude/skills/jft-sinh-de`) | Sinh/QC câu chất lượng cao, đổi SVG → PNG |

```
SYLLABUS_IRODORI ─┐
BLUEPRINT (tick) ─┴─▶ [1] Claude sinh câu ─▶ QUESTION_BANK (Draft)
                                                │  GV duyệt → Approved
                     [2] TTS ◀── Script ────────┤
                     [3] SVG ◀── ImagePrompt ───┤
                                                ▼
                     [4] Ráp đề theo số câu/dạng ─▶ file .xlsx import Mankai LMS
```

## Các sheet

| Sheet | Nội dung |
|---|---|
| `CONFIG` | Model, phạm vi quyển/bài, giọng TTS, tốc độ đọc |
| `SYLLABUS_IRODORI` | Book · Lesson · Topic · Can-do · Vocab · Kanji · Grammar — **nhập từ giáo trình gốc** |
| `BLUEPRINT` | 11 dạng bài của 4 phần thi (文字と語彙 / 会話と表現 / 聴解 / 読解), số câu sinh mỗi lần, số câu/đề |
| `QUESTION_BANK` | Câu hỏi + Script nghe + 4 phương án + đáp án + giải thích VI + link audio/hình + Status |
| `EXAM_LOG` | Lịch sử đề đã ráp, link file import, danh sách ID câu |

> ⚠️ Tên dạng bài trong `BLUEPRINT` là bản khởi tạo — đối chiếu với **đề mẫu chính thức trên trang JFT-Basic của Japan Foundation** rồi chỉnh tên/số câu cho khớp.

## Cài đặt (≈15 phút)

**Bước 1 — Tạo Sheet + Script**
1. Tạo Google Sheet mới → **Extensions › Apps Script**
2. Dán nội dung `apps-script/Code.gs` vào `Code.gs`
3. ⚙️ Project Settings → tick *Show "appsscript.json"* → dán nội dung `apps-script/appsscript.json`

**Bước 2 — Lấy API key**
| Key | Lấy ở đâu |
|---|---|
| `CLAUDE_API_KEY` | console.anthropic.com → API Keys |
| `GCP_TTS_API_KEY` | console.cloud.google.com → bật **Cloud Text-to-Speech API** → Credentials → Create API key (giới hạn key chỉ cho TTS API) |
| `DRIVE_FOLDER_ID` | Tạo thư mục Drive, copy đoạn ID cuối URL |

→ Project Settings → **Script Properties** → thêm 3 dòng trên.

**Bước 3 — Khởi tạo**
Reload Sheet → menu **🎌 JFT Generator › 0. Khởi tạo cấu trúc sheet** → cấp quyền.

**Bước 4 — Nhập phạm vi Irodori**
Điền `SYLLABUS_IRODORI` mỗi bài 1 dòng (lấy từ mục lục / danh sách từ vựng / kanji của giáo trình). Có thể nhờ Claude Code chuẩn hoá từ file PDF/Excel bạn có.

## Quy trình vận hành

| Bước | Thao tác | Ai làm |
|---|---|---|
| 1 | Tick dạng bài ở `BLUEPRINT` → menu **1. Sinh câu hỏi** | R&D |
| 2 | Duyệt `QUESTION_BANK`: sửa câu, đổi `Status` = `Approved` | GV Việt + GV Nhật |
| 3 | Menu **2. Tạo audio** (câu có Script) | R&D |
| 4 | Menu **3. Tạo hình** → tải thư mục `images` về → `cd tools && npm i && node svg2png.mjs <thư_mục>` → upload PNG lại vào `images` | R&D |
| 5 | Menu **4. Xuất file import LMS** → tải `.xlsx` trong thư mục `exams` → import vào Mankai LMS | R&D |

## File import LMS (mẫu MULTIPLE CHOICE – Advanced)

Sheet `MULTIPLE CHOICE (Advanced)`, giữ nguyên tên sheet và tên cột:

| Cột | Lấy từ QUESTION_BANK |
|---|---|
| Audio Url | `AudioURL` → đổi sang link tải trực tiếp |
| Content | `Stem` |
| Correct Answer | `Answer` A/B/C/D → **1/2/3/4** |
| Explanation | `Explanation_VI` |
| Image Url | PNG cùng ID (nếu có), nếu không thì SVG |
| Option 1–4 | `OptionA–D` |
| STT | Thứ tự trong đề |
| Tag | `JFT\|Phần thi\|Dạng bài\|Quyển+Bài`, ví dụ `JFT\|文字と語彙\|漢字の読み\|入門L3` |

Không có dòng "LƯU Ý" → upload thẳng, không cần xoá gì.

## Audio — tuỳ chọn giọng

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| **Google Cloud TTS — Chirp3-HD** (khuyến nghị cho nghe hiểu) | Rất tự nhiên, ngữ điệu hội thoại | Không hỗ trợ SSML `<break>` |
| Google Cloud TTS — Neural2 (mặc định) | Ổn định, hỗ trợ SSML ngắt nghỉ | Hơi "đọc" hơn Chirp3 |
| VOICEVOX (miễn phí, chạy local) | Không tốn phí | Giọng anime, không hợp đề thi |
| ElevenLabs | Rất tự nhiên | Trả phí, accent đôi khi lệch |

Đổi giọng tại `CONFIG › TTS_VOICE_F / TTS_VOICE_M`. Script nghe viết theo định dạng:
```
N: 会社で、女の人と男の人が話しています。
F: 田中さん、明日の会議は何時からですか。
M: 10時からです。
```

## Giới hạn đã biết
- Audio/hình được xuất dạng **link trực tiếp Drive** (file chia sẻ "Anyone with link"). Nếu LMS không phát được link Drive → upload file lên kho media của LMS rồi thay cột `Audio Url` / `Image Url`.
- Drive có thể chặn tải khi 1 file bị truy cập quá nhiều (thi đông người cùng lúc) → đề thi chính thức nên dùng kho media của LMS.
- Apps Script giới hạn **6 phút/lần chạy** → mỗi lần sinh ≤ 5 câu/dạng, vẽ ≤ 15 hình/lần; chạy lại menu để làm tiếp.
- Câu do AI sinh **luôn ở trạng thái Draft** — bắt buộc GV duyệt trước khi vào đề.
