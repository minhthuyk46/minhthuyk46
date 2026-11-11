---
name: live-ppt-de-luyen
description: Tạo bộ slide NGANG 16:9 theo brand Mankai để chiếu đề luyện JLPT (文字・語彙 / 文法, N3–N1, sách 日本語パワードリル, 徹底トレーニング hoặc đề tự soạn) trên TikTok LIVE — slide đặt giữa khung dọc (camera Sensei ở trên, comment ở dưới), furigana như sách gốc, slide đáp án chỉ tô cam khung đúng, Neko-chan theo nhịp. Dùng khi người dùng nói "làm slide live 第N回", "tạo slide chiếu đề luyện", "slide livestream luyện đề".
---

# Skill: Slide luyện đề cho TikTok LIVE

## Đầu ra
`.pptx` **ngang 16:9 (1920×1080)**, mỗi slide là 1 ảnh full khung (dựng bằng HTML để có furigana `<ruby>` như sách).

Thứ tự: Bìa → Luật chơi → [Tiêu đề 問題 → (Câu hỏi → Đáp án) × n] × 問題 → Bảng đáp án → Kết.

## Bố cục live (khung dọc TikTok 1080×1920)
| Vùng | Nội dung |
|---|---|
| Trên (~y 240–760) | Camera Sensei + banner tiêu đề live (TikTok đè avatar/Follow lên phần đầu) |
| **Giữa (~y 760–1370)** | **Slide 16:9 này**, full chiều ngang màn hình |
| Dưới | Comment + quà |

## Bố cục slide (1920×1080)
| Thành phần | Thông số |
|---|---|
| Thanh tiêu đề | cam, "Luyện đề N3 語彙 · 第3回" + 問題·câu |
| Thẻ câu hỏi | cao 300px, chữ Nhật 52–84px tự co theo độ dài, furigana trên chữ Hán, từ được hỏi gạch chân |
| 4 lựa chọn | lưới 2×2, chữ 66px. Đáp án: khung đúng nền cam #F37142 + chữ nâu mực, còn lại mờ |
| Trạng thái | ⏱ 0:25 · 💬 Comment 1–4 → ✔ Đáp án N; Neko góc phải dưới |
| 用法 (lựa chọn > 14 ký tự) | 4 câu xếp dọc full ngang, chữ 46px, không Neko |

Brand: trắng 60% · cam 25% · vàng 10%; chữ nâu mực #2B1D16; không chữ trắng trên cam; Be Vietnam Pro + Noto Sans JP. Neko (`assets/neko/`): `vay-chao` (bìa, luật, kết), `suy-nghi` (tiêu đề 問題, câu hỏi), `bien-dung` (đáp án), `cup-vang` (bảng đáp án).

## Quy trình
1. Đọc trang PDF (Read `pages`), gõ lại đề **nguyên văn**, furigana chỉ ở đúng chỗ sách có. Từ được hỏi ở 問題1 không có furigana.
2. Lấy `dap_an` từ trang **解答 ở cuối file PDF** (sau phần đề; ví dụ N2 文字・語彙: PDF trang 81+, N3 文字・語彙: PDF trang 72+). 徹底トレーニング N1 文字・語彙: 第N回 đánh số liên tục theo dạng bài (問題1: 第1–24回, 問題2 文脈規定: 第25–66回, 問題3: 第67–82回, 問題4: 第83回–), đáp án ở file 解答 (sách tr.241+). Tự giải thêm một lượt để đối chiếu; lệch thì báo người dùng, không tự sửa đáp án của sách.
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
Hướng dọc → nguồn Camera đặt phần trên (kèm banner tiêu đề) → nguồn Window capture cửa sổ PowerPoint trình chiếu, kéo full ngang ở giữa khung → bấm → để qua slide.
