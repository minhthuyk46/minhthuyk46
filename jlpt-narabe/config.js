/* ===== Cấu hình trang. Sửa file này, không cần động vào index.html ===== */
window.NARABE_CONFIG = {
  /* --- Đăng nhập (đang TẮT). Điền apiUrl theo apps-script/HUONG_DAN.md khi muốn bật --- */
  apiUrl: '',
  googleClientId: '',
  privacyUrl: '',

  /* --- Kênh của cô Thuỳ --- */
  social: {
    name: 'Thuỳ Sensei Chuyên N1 N2',
    tagline: 'Theo dõi cô để xem mẹo làm bài ★, chữa đề JLPT và lịch livestream mới nhất nhé các bạn!',
    links: [
      { type: 'tiktok',   label: 'TikTok',   handle: '@thuyss.mankai', url: 'https://www.tiktok.com/@thuyss.mankai' },
      { type: 'facebook', label: 'Facebook', handle: 'thuyss.mankai',  url: 'https://www.facebook.com/thuyss.mankai' }
    ]
  },

  /* --- Banner quảng cáo live. Đổi show: true để bật.
         Banner tự ẩn sau thời điểm endsAt (giờ Việt Nam). --- */
  live: {
    show: false,
    title: 'Live chữa đề 並べ替え N2 cùng Thuỳ Sensei',
    time: '20:00 · Thứ Năm 27/11',
    desc: 'Cô chữa các câu ★ học viên hay sai nhất kỳ 07/2026.',
    button: 'Nhắc tôi xem live',
    url: 'https://www.facebook.com/thuyss.mankai',
    endsAt: '2026-11-27T22:00:00+07:00'
  }
};
