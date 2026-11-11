---
name: live-ppt-de-luyen
description: Tạo bộ slide dọc 9:16 theo brand Mankai để chiếu đề luyện JLPT (文字・語彙 / 文法, N3–N2, sách 日本語パワードリル hoặc đề tự soạn) trên TikTok LIVE — furigana như sách gốc, camera Sensei xoá phông ở góc phải dưới, slide đáp án chỉ tô cam khung đúng, Neko-chan theo nhịp. Dùng khi người dùng nói "làm slide live 第N回", "tạo slide chiếu đề luyện", "slide livestream luyện đề".
---

# Skill: Slide luyện đề cho TikTok LIVE

## Đầu ra
`.pptx` dọc 1080×1920, mỗi slide là 1 ảnh full khung (dựng bằng HTML để có furigana `<ruby>` như sách).

Thứ tự: Bìa → Luật chơi → [Tiêu đề 問題 → (Câu hỏi → Đáp án) × n] × 問題 → Bảng đáp án → Kết.

## Bố cục (đã đo theo preview TikTok LIVE Studio của Mankai)
| Vùng | y (px) | Nội dung |
|---|---|---|
| TikTok che (avatar, ranking, LIVE Goal) | 0–260 | Seigaiha cam 10% |
| Thanh tiêu đề | 268–344, x ≥ 210 | "Luyện đề N3 語彙 · 第3回" + 問題·câu |
| Thẻ câu hỏi | 378–658 | Noto Sans JP, furigana trên chữ Hán, từ được hỏi gạch chân |
| 4 lựa chọn | 700–1170, rộng 660 | Đáp án đúng: nền cam #F37142, chữ nâu mực, bóng đổ cứng; còn lại mờ |
| Trạng thái + Neko | 1125–1330 | ⏱ / 💬 Comment 1–4 → ✔ Đáp án N |
| **Camera Sensei xoá phông** | x 760–1050, y 770–1320 | Khung đào nhạt trống, ghép camera trong LIVE Studio |
| TikTok comment + quà | 1330–1920 | Chỉ nền |
Câu 用法 (lựa chọn > 12 ký tự): tự chuyển sang lựa chọn full ngang, bỏ khung camera/Neko để đủ chỗ.

Brand: trắng 60% · cam 25% · vàng 10%; chữ nâu mực #2B1D16; không chữ trắng trên cam; Be Vietnam Pro + Noto Sans JP. Neko: `vay-chao` (bìa, luật, kết), `suy-nghi` (câu hỏi), `bien-dung` (đáp án), `cup-vang` (bảng đáp án) — trong `assets/neko/`, lấy từ kho linh vật Mankai.

## Quy trình
1. Đọc trang PDF (Read `pages`), gõ lại đề **nguyên văn**, furigana chỉ ở đúng chỗ sách có. Từ được hỏi ở 問題1 không có furigana.
2. Lấy `dap_an` từ trang **解答 ở cuối file PDF** (sau phần đề; ví dụ N2 文字・語彙: PDF trang 81+, N3 文字・語彙: PDF trang 72+). Tự giải thêm một lượt để đối chiếu; lệch thì báo người dùng, không tự sửa đáp án của sách.
3. Viết JSON (mẫu: `examples/n3_goi_03.json`).
4. `python3 scripts/build_live_ppt.py de.json -o exports/Live_<...>.pptx` (cần node + playwright có sẵn). Thêm `KEEP_PNG=1` để giữ ảnh kiểm tra.
5. Xem ảnh vài slide (câu dài, 用法, hội thoại A/B) → tràn thì thêm `co_chu` / `co_chu_lc` cho câu đó.

## Markup
| Viết | Hiển thị |
|---|---|
| `{漢字|かな}` | furigana trên chữ |
| `__từ__` | gạch chân + đậm |
| `\n` | xuống dòng (A：… / B：…) |
| `（　　）` | chỗ trống |

## Live trong TikTok LIVE Studio
Hướng dọc → nguồn 1: cửa sổ PowerPoint trình chiếu (full khung) → nguồn 2: camera bật xoá phông, đặt vào khung đào nhạt góc phải dưới → bấm → để qua slide.
