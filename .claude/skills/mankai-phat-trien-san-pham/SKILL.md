---
name: mankai-phat-trien-san-pham
description: Phân tích vấn đề người học và phát triển hệ sản phẩm đào tạo của Mankai (JLPT, BJT, tiếng Nhật IT, TNGD) theo 4 tầng Miễn phí – Giá rẻ – Trung – Cao, từ dữ liệu các team Sale/MKT/Vận hành/Đào tạo đến cây cơ hội, quy tắc chia tầng và SOP triển khai. Dùng khi người dùng nói "phân tích vấn đề người học", "gom input các team", "dựng cây vấn đề", "chia tầng sản phẩm", "lên gói miễn phí/giá rẻ/trung/cao", "viết SOP phát triển sản phẩm", "JTBD người học", hoặc đưa link sheet "Phân tích vấn đề người học".
---

# Phát triển sản phẩm đào tạo theo DNA Mankai

Khung phương pháp: Problem Statement, Jobs-to-be-Done, Opportunity Solution Tree (Teresa Torres), Good–Better–Best packaging. Điều chỉnh cho đào tạo tiếng Nhật và cho cách vận hành của Mankai. Đọc `references/dna-mankai.md` trước khi làm bất kỳ bước nào.

## Input (hỏi nếu thiếu, tối đa 1 lần)
- Link Google Sheet input (mặc định: sheet "Phân tích vấn đề người học Mankai", tab Sale / MKT / Vận hành / Đào tạo, cột: STT · Ai là người gặp vấn đề · Xếp loại · What 1 · How · What 2 · Đối thủ · Người viết)
- Dòng sản phẩm đang làm (JLPT / BJT / IT / TNGD) và cấp độ (N5–N1)
- Bước cần làm (1–6 bên dưới). Không nói rõ → làm bước kế tiếp còn thiếu.

## Quy trình 6 bước

| Bước | Việc | Đầu ra | Ghi vào |
|---|---|---|---|
| 1. Làm sạch input | Đọc mọi tab → chuẩn hóa, gộp trùng, đánh dấu ô thiếu | Danh sách vấn đề sạch + log trùng/thiếu | Tab `01_INPUT_SACH` |
| 2. Bổ sung góc Đào tạo | Với mỗi phân khúc, hỏi "HV hỏng ở cơ chế học nào?" (xem `references/khung-phan-tich.md` §1) | Dòng mới cho tab Đào tạo | Tab `Đào tạo` |
| 3. Problem Statement + JTBD | Mỗi cụm vấn đề → 1 câu vấn đề + Job (chức năng/xã hội/cảm xúc) | Thẻ phân khúc | Tab `02_JTBD` |
| 4. Cây cơ hội (OST) | Kết quả mong muốn → Cơ hội → Giải pháp → Thử nghiệm | Cây + điểm ưu tiên | Tab `03_CAY_CO_HOI` |
| 5. Chia 4 tầng | Đặt từng giải pháp vào tầng theo quy tắc §4 | Ma trận tầng × quyền lợi | Tab `04_MA_TRAN_TANG` |
| 6. SOP triển khai | Mỗi gói → SOP theo khung §5 | SOP từng gói | Google Doc / tab `05_SOP` |

Hết mỗi bước: dừng, tóm tắt 3–5 dòng (đã làm gì, phát hiện chính, điểm cần chốt), hỏi có đi tiếp không. Không chạy liền 6 bước.

## Quy tắc bắt buộc

1. **Vấn đề ≠ giải pháp.** Cột What 1 chứa giải pháp ("cần flashcard") → tách thành vấn đề ("quên từ sau 3 ngày") và ghi chú.
2. **Giữ nguyên dữ liệu gốc.** Không sửa, xóa hay đổi thứ tự các tab của team khác. Kết quả ghi vào tab mới; chỉ được thêm dòng vào tab Đào tạo khi người dùng đồng ý.
3. **Không bịa đối thủ.** Thông tin đối thủ chỉ lấy từ sheet hoặc nguồn có link; chưa kiểm chứng thì ghi "(cần xác minh)".
4. **Gắn "Xếp loại".** Nhóm "k tự nhận diện được" không bán bằng tên vấn đề, phải có **công cụ chẩn đoán** (test, báo cáo lỗi) làm cửa vào. Mỗi vấn đề loại này phải có ít nhất 1 cơ chế chẩn đoán ở tầng Miễn phí hoặc Giá rẻ.
5. **Đo được.** Mỗi giải pháp có chỉ số đầu ra (Can-do, % hoàn thành, điểm mini test, tỷ lệ đỗ) và người phụ trách đo.
6. **Nghĩ như người vận hành.** Mỗi giải pháp trả lời được: GV/trợ giảng triển khai được không, mất bao nhiêu giờ công/HV, LMS có làm được không.
7. **Ghi nguồn insight.** Ghi rõ insight đến từ team nào/người nào; nhiều team cùng nêu → độ tin cậy cao hơn.

## Định dạng đầu ra
- Bảng trước, giải thích sau; tiếng Việt, thuật ngữ giữ nguyên (JTBD, OST, LMS, Can-do).
- Ghi sheet: dùng connector Google Sheets; tạo tab mới thay vì ghi đè. Cột đúng như mô tả trong `references/khung-phan-tich.md`, không tự thêm cột STT thừa.
- Không đủ dữ liệu để kết luận → ghi "Giả định cần kiểm chứng" và đề xuất cách kiểm (khảo sát, phỏng vấn 5 HV, dữ liệu LMS).

## Tài liệu kèm
- `references/dna-mankai.md`: DNA, phân khúc, đối thủ, 4 tầng của Mankai
- `references/khung-phan-tich.md`: chi tiết từng bước, mẫu bảng, quy tắc chia tầng, khung SOP
