---
name: live-ppt-de-luyen
description: Tạo PowerPoint dọc 9:16 theo brand Mankai để chiếu câu đề luyện JLPT (文字・語彙 / 文法, N3–N2, sách 日本語パワードリル hoặc đề tự soạn) trên TikTok LIVE — nội dung nằm trong vùng an toàn của TikTok, slide câu hỏi rồi slide đáp án chỉ tô màu khung đáp án đúng, bảng đáp án cuối buổi. Dùng khi người dùng nói "làm PPT live 第N回", "tạo slide chiếu đề luyện", "slide livestream luyện đề", "chuyển đề sang slide live".
---

# Skill: PPT chiếu đề luyện trên livestream

## Đầu ra
1 file `.pptx` **dọc 9:16 (1080×1920)**. Dùng với TikTok LIVE Studio (chế độ dọc) bằng cách share cửa sổ PowerPoint.

| Thứ tự | Slide |
|---|---|
| 1 | Bìa: level · sách · 回 · giờ live · nguồn |
| 2 | Luật chơi: thời gian, cú pháp comment `1-3 2-2…` |
| 3 | Tiêu đề 問題 (lặp lại cho mỗi 問題) |
| 4 | **Câu hỏi**: câu + 4 lựa chọn xếp dọc |
| 5 | **Đáp án**: giống slide câu hỏi, **chỉ tô màu thương hiệu khung đáp án đúng**, không giải thích |
| cuối | Bảng đáp án + slide kết |

`che_do`: `xen_ke` (câu → đáp án) hoặc `chua_sau` (hết câu → HẾT GIỜ → lần lượt các đáp án).

### Vùng an toàn TikTok LIVE (khung 7.5 × 13.33 inch)
| Vùng | Bị TikTok che bởi | Script xử lý |
|---|---|---|
| Trên 0–1.75in (~13%) | avatar host, số người xem, nút X | chỉ dải màu trang trí |
| Phải 6.55–7.5in | icon quà, share | để trống |
| Dưới 9.05in trở xuống (~32%) | comment, ô chat, quà | để trống, chỉ tên thương hiệu nhỏ |

### Brand
Mọi màu, font, logo nằm trong `brand.json`. Đổi theo brand guideline chính thức của Mankai: `chu_dao` (màu chủ đạo, dùng cho khung đáp án đúng), `phu`, `nen`, `logo` (đường dẫn PNG, tương đối với brand.json). **Không sửa màu trong script.**

## Quy trình
1. **Xác định**: level, sách, 回, các 問題 cần chiếu, chế độ chữa (`xen_ke` = chữa từng câu / `chua_sau` = làm hết rồi chữa).
2. **Lấy đề**: đọc trang PDF (Read với `pages`). Sách scan không có text → gõ lại nguyên văn, giữ đúng trợ từ, dấu câu, khoảng trống `（　　）`.
3. **Giải đề**: chỉ cần `dap_an`, không cần viết giải thích. Đáp án tự giải phải báo người dùng **đối chiếu 別冊** (file scan không có đáp án).
4. **Viết JSON** theo schema bên dưới → lưu vào scratchpad.
5. **Chạy**: `python3 scripts/build_live_ppt.py de.json -o <output>.pptx` (script tự kiểm: đủ 4 lựa chọn, đáp án 1–4, câu 並べ替え có ★).
6. **Kiểm tra hình**: `soffice --headless --convert-to pdf` → `pdftoppm -r 30 -png` → xem slide câu dài, 用法, 並べ替え có tràn chữ không.
7. Gửi file cho người dùng + nêu các câu đáp án cần đối chiếu.

## Schema JSON
```json
{
  "meta": {
    "level": "N3", "sach": "文字・語彙", "hoi": "第1回",
    "ngay": "Tối thứ 2 · 20:00", "thoi_gian": "10 phút",
    "nguon": "日本語パワードリル N3 文字・語彙 (アスク出版)",
    "kenh": "Mankai Academy",
        "che_do": "xen_ke",         // xen_ke | chua_sau
    "ket_thuc": ["Hẹn gặp lại 第2回 👋"]
  },
  "mondai": [
    {
      "ten": "問題1", "dang": "漢字読み",
      "yeu_cau": "＿＿のことばの読み方として最もよいものを…",
      "cau_hoi": [
        {"so": 1, "cau": "とても__悲しい__話を聞いた。",
         "lua_chon": ["おかしい","かなしい","きびしい","さびしい"], "dap_an": 2}
      ]
    }
  ]
}
```

### Markup trong `cau` / `lua_chon`
| Viết | Hiển thị | Dùng cho |
|---|---|---|
| `__悲しい__` | gạch chân, tô màu nhấn | 漢字読み, 表記, 言い換え, 用法 |
| `{夫婦|ふうふ}` | 夫婦(ふうふ) | furigana có trong đề |
| `★` | sao đỏ | 並べ替え |
| `（　　）` | giữ nguyên | chỗ trống |

### Câu 並べ替え (文法 問題2)
Thêm `"loai": "sapxep"`, `cau` có `＿＿ ＿＿ ★ ＿＿`. `dap_an` = số của lựa chọn nằm ở ★.

### Câu 用法 (語彙 問題5)
`cau` = từ được hỏi (vd `"{夢中|むちゅう}"`), `lua_chon` = 4 câu đầy đủ, từ được hỏi bọc `__…__`. Script tự xếp dọc.

### Bài đọc 文章の文法 (文法 問題3)
Chưa có layout riêng: đặt đoạn văn vào `yeu_cau` của slide 問題 (rút gọn nếu dài), mỗi chỗ trống là 1 câu với `cau` = "（ 1 ）に入るもの" + câu chứa chỗ trống.

## Nguyên tắc
- Chữ đọc được trên điện thoại: script tự chọn cỡ (câu 22–30pt, lựa chọn 17–28pt); tràn thì thêm `co_chu` / `co_chu_lc` cho câu đó.
- Không đặt gì quan trọng ngoài vùng an toàn.
- Tiếng Nhật gõ lại **đúng tuyệt đối** với sách; không tự sửa đề.
- Ghi nguồn sách ở bìa. Không chèn ảnh scan trang sách (rủi ro bản quyền khi phát công khai).
- Mẫu đầy đủ: `examples/n2_bunpou_01.json` (N2 文法 第1回, 問題1–2).
