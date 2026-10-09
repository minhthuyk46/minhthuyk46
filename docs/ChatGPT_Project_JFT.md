# ChatGPT – Project "JFT Irodori Soạn câu" (Agent hẹn giờ + làm tay dự phòng)

ChatGPT đóng vai **người soạn**: đọc brief trong Sheet, viết câu, dán JSON vào đúng ô. Mọi quy tắc nội dung đã nằm sẵn trong từng brief (tab `08_PROMPT` + dữ liệu bài), nên Instructions chỉ nói cách làm việc với Sheet. Không dùng API, chi phí = gói ChatGPT Plus/Pro sẵn có.

## 1. Cài 1 lần

1. ChatGPT → **Projects → New project**, đặt tên **JFT Irodori Soạn câu**.
2. Bấm **Instructions**, dán nguyên khung ở mục 2, Save.
3. **Add files** (tuỳ chọn): file tiêu chuẩn 11 dạng JFT để ChatGPT đối chiếu khi cần.
4. **Settings → Apps / Connectors**: bật **Google Drive**, đăng nhập đúng tài khoản giữ Sheet.

## 2. Instructions (dán vào Project)

```
Bạn là người soạn câu luyện thi JFT-Basic (đầu ra A2) theo giáo trình いろどり cho Học viện Mankai.

NGUỒN VIỆC
- Google Sheet "JFT Irodori – Hệ thống luyện thi (theo tiêu chuẩn 11 dạng)".
- Tab "10_YEU_CAU": dòng có Trạng thái "Chờ sản xuất" là việc cần làm. Lệnh đầy đủ nằm ở ô "Brief cho ChatGPT".
- Tab "20_NGAN_HANG": dòng có Trạng thái "Cần sửa", ô "Brief sửa cho ChatGPT" có nội dung và ô "Kết quả sửa (dán JSON)" trống là câu cần sửa.

CÁCH LÀM MỖI BRIEF
- Làm ĐÚNG brief: quy tắc, số câu, mục nguồn, ngữ liệu, kho hình, giới hạn bài (QD-12) đều nằm trong brief. Không dùng từ vựng/ngữ pháp ngoài phạm vi bài.
- Trả về đúng 1 khối JSON theo khuôn cuối brief, không viết gì thêm.
- Dạng có tranh: chỉ ghi "ma_hinh" khi mã có trong KHO HÌNH của brief; không có thì để "" và viết "brief_hinh" thật cụ thể. KHÔNG tự vẽ trong lúc soạn câu.
- Dạng nghe: script_audio mỗi lượt 1 dòng, nhãn N： / F： / M：; lựa chọn là "1","2","3".
- Trước khi dán, tự kiểm: đúng số câu; mỗi câu đúng số lựa chọn (3, riêng 2-1 là 4), không trùng; đáp án là số thứ tự; JSON hợp lệ.

DÁN KẾT QUẢ
- Yêu cầu: dán nguyên JSON vào ô "Kết quả ChatGPT (dán JSON)" cùng dòng.
- Sửa câu: dán JSON (1 câu) vào ô "Kết quả sửa (dán JSON)" cùng dòng.
- KHÔNG sửa bất kỳ ô nào khác (Trạng thái, QC, câu cũ…). Sheet tự kiểm tra và chuyển trạng thái.
- Sau khi dán, nếu cột "Lỗi" báo JSON hỏng thì dán lại bản đủ.
- Phiếu nhiều câu có thể tự sang lượt sau (ô Brief có nội dung mới, Trạng thái lại "Chờ sản xuất"): làm tiếp cho đến khi không còn.

KHI KHÔNG TỰ DÁN ĐƯỢC VÀO SHEET
Trả lời theo mẫu, theo thứ tự dòng:
### Yêu cầu [Mã YC]   (hoặc: Sửa [Mã câu])
(1 khối JSON để copy)
```

## 3. Lịch tự chạy 6:00 sáng (ChatGPT Agent)

1. Trong Project, mở chat mới, chọn chế độ **Agent**.
2. Dán câu lệnh dưới. Lần đầu Agent mở Google thì bấm **Take over** để tự đăng nhập, xong trả quyền lại.
3. Chạy đúng ý thì bấm biểu tượng **Schedule** của cuộc chat → **Hằng ngày – 6:00**.

```
Làm hết việc đang chờ trong Sheet "JFT Irodori – Hệ thống luyện thi (theo tiêu chuẩn 11 dạng)" theo Instructions của project:
1. Tab "10_YEU_CAU": mọi dòng Trạng thái "Chờ sản xuất". Đọc ô "Brief cho ChatGPT", soạn, dán JSON vào ô "Kết quả ChatGPT (dán JSON)". Đợi vài giây; nếu ô Brief sang lượt mới thì làm tiếp.
2. Tab "20_NGAN_HANG": mọi dòng Trạng thái "Cần sửa" có "Brief sửa cho ChatGPT". Sửa theo brief, dán JSON vào "Kết quả sửa (dán JSON)".
3. Không sửa cột nào khác.
4. Cuối cùng báo ngắn: đã làm phiếu nào, sửa câu nào, dòng nào báo Lỗi.
Không có việc: báo "Không có việc cần làm" và dừng.
```

Giới hạn thật: Agent có số lượt/tháng theo gói (Pro nhiều hơn Plus); mỗi sáng 1 lượt ≈ 30 lượt/tháng. Agent thao tác trên trình duyệt nên đôi khi dán thiếu; cột Lỗi sẽ báo và lượt sau làm lại. Tên nút có thể khác chút theo phiên bản ChatGPT.

## 4. Làm tay (dự phòng, ~5 phút/phiếu)

1. Bấm ô "Brief cho ChatGPT" → Ctrl+C → dán vào chat mới trong Project (dùng model mạnh nhất của gói).
2. Bấm Copy khối JSON ChatGPT trả về → dán vào ô "Kết quả ChatGPT (dán JSON)" cùng dòng. Câu hiện ngay trong 20_NGAN_HANG.
3. Câu cần sửa: làm tương tự với "Brief sửa" và "Kết quả sửa".

## 5. Tranh

| Trường hợp | Làm gì |
|---|---|
| Có hình trong sách Irodori | Cắt hình (không kèm lời giải), đặt tên `H001.png`, bỏ vào folder **kho_hinh** (menu 📁), thêm 1 dòng ở `09_KHO_HINH` (Mã, Cấp, Bài, Nguồn trang, Mô tả, Từ/điểm thể hiện). Script tự gắn link; brief tự liệt kê hình của bài để ChatGPT chọn mã. Ghi nguồn "いろどり 生活の日本語 (国際交流基金)"; chỉ dùng nội bộ cho học viên. |
| Sách không có | Câu mới sinh có sẵn ô **"Prompt vẽ tranh (ChatGPT)"** → copy sang ChatGPT (trong Project hoặc chat thường) → tải ảnh, đặt tên đúng **mã câu** (`JQ-0007.png`) → bỏ vào folder kho_hinh. Script tự gắn URL hình. |

## 6. Audio hội thoại (0 đồng)

- **Chính – Gemini TTS (menu 🔊)**: script gửi lời dẫn N bằng 1 giọng và hội thoại F/M bằng 2 giọng trong 1 lần đọc, ghép thành 1 file WAV/nhóm. Cần `GEMINI_API_KEY` lấy ở aistudio.google.com và **không bật thanh toán** (không thể bị tính tiền; hết hạn mức ngày thì hôm sau chạy tiếp). Gói Gemini Pro không thay thế API key.
- **Thủ công trên AI Studio** (khi muốn nghe thử trước): aistudio.google.com → Generate speech → chế độ 2 người nói → dán script → tải file → đặt tên mã câu/mã nhóm → upload, dán link vào cột URL audio.
- **Dự phòng – VOICEVOX** (miễn phí, chạy trên máy): mỗi dòng chọn 1 nhân vật, xuất WAV. Phải ghi "VOICEVOX:Tên nhân vật" ở phần ghi nguồn; tránh nhân vật cần xin phép khi doanh nghiệp dùng.
- Link Drive có thể không phát trong LMS: khi xuất, upload audio/hình lên kho media LMS rồi thay Audio Url / Image Url.
