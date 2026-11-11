---
name: live-ppt-de-luyen
description: Tạo PowerPoint 16:9 chiếu câu đề luyện JLPT (文字・語彙 / 文法, N3–N2, sách 日本語パワードリル hoặc đề tự soạn) trên livestream — slide câu hỏi chữ to, slide đáp án tô xanh + giải thích + phân tích phương án nhiễu, bảng đáp án cuối buổi. Dùng khi người dùng nói "làm PPT live 第N回", "tạo slide chiếu đề luyện", "slide livestream luyện đề", "chuyển đề sang slide live".
---

# Skill: PPT chiếu đề luyện trên livestream

## Đầu ra
1 file `.pptx` 16:9 gồm:

| Thứ tự | Slide | Ghi chú |
|---|---|---|
| 1 | Bìa: level · sách · 回 · giờ live · nguồn | |
| 2 | Luật chơi: thời gian, cú pháp comment `1-3 2-2…` | |
| 3 | Tiêu đề 問題 (tên + dạng + yêu cầu tiếng Nhật) | lặp lại cho mỗi 問題 |
| 4 | **Câu hỏi**: câu + 4 lựa chọn, chữ to | |
| 5 | **Đáp án**: đúng tô xanh ✔, sai làm mờ; giải thích + ✘ phương án nhiễu | xen kẽ sau từng câu, hoặc gom về cuối (`che_do`) |
| cuối | Bảng đáp án + slide kết (CTA) | |

Speaker Notes chứa lời gợi ý cho GV (`ghi_chu_gv`, `ghi_chu_dap_an`).

## Quy trình
1. **Xác định**: level, sách, 回, các 問題 cần chiếu, chế độ chữa (`xen_ke` = chữa từng câu / `chua_sau` = làm hết rồi chữa).
2. **Lấy đề**: đọc trang PDF (Read với `pages`). Sách scan không có text → gõ lại nguyên văn, giữ đúng trợ từ, dấu câu, khoảng trống `（　　）`.
3. **Giải và soạn giải thích** (tiếng Việt, ngắn ≤ 1 dòng/ý):
   - `giai_thich`: nghĩa + cấu trúc mẫu ngữ pháp/từ.
   - `phuong_an_nhieu`: 1–2 phương án dễ nhầm nhất, nói vì sao sai.
   - Đáp án tự giải phải ghi rõ cho người dùng là **cần đối chiếu 別冊** (file scan không có đáp án).
4. **Viết JSON** theo schema bên dưới → lưu vào scratchpad.
5. **Chạy**: `python3 scripts/build_live_ppt.py de.json -o <output>.pptx` (script tự kiểm: đủ 4 lựa chọn, đáp án 1–4, câu 並べ替え có ★).
6. **Kiểm tra hình**: `soffice --headless --convert-to pdf` → `pdftoppm -r 40 -png` → xem vài slide (câu dài, 用法, 並べ替え) có tràn chữ không. Tràn → thêm `"co_chu": 26` cho câu đó.
7. Gửi file cho người dùng + nêu các câu đáp án cần đối chiếu.

## Schema JSON
```json
{
  "meta": {
    "level": "N3", "sach": "文字・語彙", "hoi": "第1回",
    "ngay": "Tối thứ 2 · 20:00", "thoi_gian": "10 phút",
    "nguon": "日本語パワードリル N3 文字・語彙 (アスク出版)",
    "kenh": "Mankai Academy",
    "theme": "navy",            // navy (nền tối, hợp live) | light
    "che_do": "xen_ke",         // xen_ke | chua_sau
    "ket_thuc": ["Hẹn gặp lại 第2回 👋"]
  },
  "mondai": [
    {
      "ten": "問題1", "dang": "漢字読み",
      "yeu_cau": "＿＿のことばの読み方として最もよいものを…",
      "cau_hoi": [
        {"so": 1, "cau": "とても__悲しい__話を聞いた。",
         "lua_chon": ["おかしい","かなしい","きびしい","さびしい"], "dap_an": 2,
         "giai_thich": "悲(かな)しい: buồn.",
         "phuong_an_nhieu": {"4": "さびしい = 寂しい: cô đơn"}}
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
Thêm `"loai": "sapxep"`, `cau` có `＿＿ ＿＿ ★ ＿＿`, cùng `thu_tu` ("4 → 3 → 2 → 1") và `cau_hoan_chinh`. `dap_an` = số của lựa chọn nằm ở ★.

### Câu 用法 (語彙 問題5)
`cau` = từ được hỏi (vd `"{夢中|むちゅう}"`), `lua_chon` = 4 câu đầy đủ, từ được hỏi bọc `__…__`. Script tự xếp dọc.

### Bài đọc 文章の文法 (文法 問題3)
Chưa có layout riêng: đặt đoạn văn vào `yeu_cau` của slide 問題 (rút gọn nếu dài), mỗi chỗ trống là 1 câu với `cau` = "（ 1 ）に入るもの" + câu chứa chỗ trống.

## Nguyên tắc
- Chữ trên slide phải đọc được trên điện thoại: câu ≥ 28pt, lựa chọn ≥ 22pt; không nhồi > 4 dòng giải thích.
- Tiếng Nhật gõ lại **đúng tuyệt đối** với sách; không tự sửa đề.
- Ghi nguồn sách ở bìa. Không chèn ảnh scan trang sách (rủi ro bản quyền khi phát công khai).
- Mẫu đầy đủ: `examples/n2_bunpou_01.json` (N2 文法 第1回, 問題1–2).
