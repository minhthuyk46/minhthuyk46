/* ===== Cấu hình trang. Sửa file này, không cần động vào index.html ===== */
window.NARABE_CONFIG = {
  /* --- Đăng nhập (đang TẮT). Điền apiUrl theo apps-script/HUONG_DAN.md khi muốn bật --- */
  apiUrl: '',
  googleClientId: '',
  privacyUrl: '',

  /* --- Kênh của cô Thuỳ --- */
  social: {
    name: 'Thuỳ Sensei Chuyên N1 N2',
    avatar: 'assets/thuy-sensei.png',
    tagline: 'Theo dõi để cập nhật lịch live, tài liệu và tips học luyện thi JLPT miễn phí.',
    links: [
      { type: 'tiktok',   label: 'TikTok',   handle: '@thuyss.mankai', url: 'https://www.tiktok.com/@thuyss.mankai' },
      { type: 'facebook', label: 'Facebook', handle: 'thuyss.mankai',  url: 'https://www.facebook.com/thuyss.mankai' }
    ]
  },

  /* --- Banner live cố định theo lịch tuần (giờ Việt Nam).
         Trong khung giờ live, nhãn tự đổi thành "ĐANG LIVE". show: false để tắt. --- */
  live: {
    show: true,
    title: 'Live luyện thi JLPT N3 · N2 · N1 cùng Thuỳ Sensei',
    days: [1, 2, 3, 4, 5],          // 0 = Chủ nhật, 1 = Thứ Hai … 6 = Thứ Bảy
    start: '16:00',
    end: '22:00',
    scheduleText: '16:00 – 22:00 · Thứ Hai đến Thứ Sáu',
    button: 'Vào xem live',
    buttonOff: 'Theo dõi để không lỡ live',
    url: 'https://www.tiktok.com/@thuyss.mankai/live',
    urlOff: 'https://www.tiktok.com/@thuyss.mankai'
  }
};
