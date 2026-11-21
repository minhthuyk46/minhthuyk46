# Hướng dẫn bật đăng nhập + lưu lịch sử vào Google Sheet

Tổng thời gian: khoảng 20 phút cho Phần A–B (đăng nhập bằng email). Phần C (nút Google) thêm khoảng 15 phút.

> Nên dùng **tài khoản Google Workspace của Mankai** để tạo Sheet và Apps Script.
> Lý do: mã đăng nhập được gửi từ tài khoản này. Gmail cá nhân chỉ gửi được khoảng **100 email/ngày**; Workspace gửi được khoảng **1.500 email/ngày**.

---

## Phần A. Tạo Sheet và dán code (10 phút)

1. Vào https://sheets.new → đặt tên Sheet, ví dụ `Luyện 並べ替え – Dữ liệu học viên`.
2. Menu **Tiện ích mở rộng** (Extensions) → **Apps Script**.
3. Trong cửa sổ Apps Script:
   1. Bấm biểu tượng ⚙️ **Cài đặt dự án** (Project Settings) ở cột trái → tick **Hiển thị tệp kê khai "appsscript.json"** (Show "appsscript.json" manifest file).
   2. Quay lại biểu tượng `< >` **Trình chỉnh sửa** (Editor).
   3. Mở tệp `appsscript.json` → xoá hết → dán toàn bộ nội dung file `jlpt-narabe/apps-script/appsscript.json`.
   4. Mở tệp `Code.gs` → xoá hết → dán toàn bộ nội dung file `jlpt-narabe/apps-script/Code.gs`.
   5. Bấm 💾 **Lưu** (Ctrl + S).
4. Ở thanh trên cùng, chọn hàm **`setup`** → bấm **▶ Chạy** (Run).
5. Google hỏi cấp quyền:
   - **Xem xét quyền** (Review permissions) → chọn tài khoản.
   - Nếu thấy *"Google chưa xác minh ứng dụng này"*: bấm **Nâng cao** (Advanced) → **Đi tới … (không an toàn)**. Đây là script của chính chị nên an toàn.
   - Bấm **Cho phép** (Allow).
6. Quay lại Sheet: sẽ thấy 4 tab mới **NguoiDung · PhienLuyen · TraLoi · TienDo**.

## Phần B. Xuất bản thành Web App (5 phút)

1. Trong Apps Script, bấm **Triển khai** (Deploy) → **Tùy chọn triển khai mới** (New deployment).
2. Bấm ⚙️ cạnh "Chọn loại" → chọn **Ứng dụng web** (Web app).
3. Điền:
   - **Mô tả**: `v1`
   - **Thực thi với tư cách**: **Tôi** (Me)
   - **Người có quyền truy cập**: **Bất kỳ ai** (Anyone)
4. Bấm **Triển khai** → **sao chép URL Ứng dụng web** (dạng `https://script.google.com/macros/s/……/exec`).
5. Mở file `jlpt-narabe/config.js`, dán URL vào `apiUrl`:
   ```js
   apiUrl: 'https://script.google.com/macros/s/……/exec',
   ```
6. Kiểm tra: mở URL đó trên trình duyệt. Nếu thấy `{"ok":true,"msg":"API luyện 並べ替え đang chạy"}` là xong.

✅ Đến đây trang đã có nút **Đăng nhập** bằng email (mã 6 số gửi qua mail).

## Phần C. Bật nút "Đăng nhập với Google" (15 phút, tuỳ chọn)

> Nút Google **chỉ chạy khi trang đã được đưa lên mạng với địa chỉ https** (xem Phần D). Mở file trực tiếp trên máy thì nút này không hoạt động.

1. Vào https://console.cloud.google.com → tạo project mới, ví dụ `mankai-luyen-de`.
2. Menu ☰ → **APIs & Services** → **OAuth consent screen** (Màn hình xin quyền):
   - **User type**: External → Create.
   - **App name**: `Mankai Academy – Luyện đề`. **Support email**: email Mankai. **Developer contact**: email Mankai.
   - **Scopes**: bỏ qua, bấm Save and continue cho đến hết.
   - Quay lại trang tổng quan → bấm **Publish app** (Xuất bản). Nếu không xuất bản, chỉ những tài khoản được thêm làm "test user" mới đăng nhập được.
3. **APIs & Services** → **Credentials** → **+ Create credentials** → **OAuth client ID**:
   - **Application type**: Web application.
   - **Authorized JavaScript origins**: thêm địa chỉ trang, ví dụ `https://luyende.mankai.vn` (không có dấu `/` ở cuối).
   - Create → sao chép **Client ID** (dạng `……apps.googleusercontent.com`).
4. Dán Client ID vào **2 nơi**:
   - File `jlpt-narabe/config.js` → `googleClientId: '……apps.googleusercontent.com'`
   - Apps Script → ⚙️ **Cài đặt dự án** → **Thuộc tính tập lệnh** (Script Properties) → **Thêm thuộc tính**: tên `GOOGLE_CLIENT_ID`, giá trị là Client ID → **Lưu**.

## Phần D. Đưa trang lên mạng

Trang là các file tĩnh (HTML/JS), cần một địa chỉ **https**. Chọn 1 trong các cách:

| Cách | Dễ | Ghi chú |
|---|---|---|
| **Netlify Drop** (https://app.netlify.com/drop) | ⭐⭐⭐ | Kéo thả thư mục `jlpt-narabe` vào trang là có link. Có thể gắn tên miền riêng của Mankai |
| GitHub Pages | ⭐⭐ | Repo phải để public (hoặc dùng gói GitHub trả phí) |
| Hosting/tên miền đang có của Mankai | ⭐⭐ | Nhờ IT chép thư mục lên, ví dụ `luyende.mankai.vn` |

**Gắn link theo kênh** để biết học viên đến từ đâu (cột `utm_source` trong tab NguoiDung):
- TikTok bio: `https://…/?utm_source=tiktok&utm_campaign=bio`
- Fanpage: `https://…/?utm_source=facebook&utm_campaign=fanpage`

## Khi sửa code Apps Script
Sau khi sửa `Code.gs` → **Triển khai** → **Quản lý việc triển khai** (Manage deployments) → ✏️ → **Phiên bản: Phiên bản mới** → **Triển khai**.
Cách này giữ nguyên URL, không phải sửa lại `config.js`.

## Dữ liệu trong Sheet

| Tab | Mỗi dòng là | Dùng để |
|---|---|---|
| **NguoiDung** | 1 học viên: email, tên, cách đăng nhập, ngày tạo, hoạt động gần nhất, thời điểm đồng ý, nguồn (UTM), số phiên, số câu, tỉ lệ đúng | Danh sách lead, lọc người học đều hoặc người đã bỏ học |
| **PhienLuyen** | 1 phiên luyện | Theo dõi tần suất luyện |
| **TraLoi** | 1 câu trả lời | Thống kê câu và mẫu ngữ pháp sai nhiều nhất → ý tưởng nội dung TikTok |
| **TienDo** | Toàn bộ tiến độ của 1 người ở 1 cấp độ (JSON) | Để trang khôi phục tiến độ khi học viên đăng nhập trên máy khác. **Không sửa tay** |

**Bảo mật**: chỉ chia sẻ Sheet cho người nội bộ cần dùng. Không đổi tên các tab và không đổi thứ tự cột.

## Giới hạn cần biết
- **Email mã đăng nhập**: khoảng 100/ngày với Gmail cá nhân, khoảng 1.500/ngày với Workspace. Học viên chỉ cần đăng nhập 1 lần, phiên đăng nhập có hiệu lực 180 ngày.
- **Lượng truy cập**: Apps Script xử lý được khoảng 30 yêu cầu cùng lúc. Đủ cho vài trăm đến 1–2 nghìn học viên luyện rải rác trong ngày. Nếu cần chạy campaign lớn (hàng nghìn người cùng lúc) thì nên chuyển sang Supabase/Firebase.
- **Mất mạng**: trang vẫn lưu trên máy và tự gửi lại khi có mạng.
