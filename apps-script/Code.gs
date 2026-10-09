/**
 * JFT Irodori – Hệ thống sản xuất câu luyện thi (v3, theo flow "Google Sheet + Apps Script + ChatGPT + Claude")
 *
 * Nguyên tắc
 *  - Sheet là nguồn sự thật duy nhất. Script KHÔNG gọi AI trả phí: chỉ soạn brief, nhận JSON, kiểm tra,
 *    chuyển trạng thái, gắn hình, tạo audio (Gemini TTS bằng API key miễn phí), xuất LMS.
 *  - ChatGPT (Project + Agent hẹn giờ, hoặc copy tay) đọc ô "Brief cho ChatGPT", dán JSON vào ô "Kết quả".
 *  - JSON sai khuôn bị từ chối, lỗi ghi ngay trên dòng; câu đúng vẫn được nhận.
 *
 * Kích hoạt: trigger khi sửa ô (xuLyKhiSua) + trigger 5 phút (chayTuDong), bật ở menu.
 * Script Properties: DRIVE_FOLDER_ID (bắt buộc), GEMINI_API_KEY (audio), GEMINI_TTS_MODEL,
 *                    VOICE_F, VOICE_M, VOICE_N (tuỳ chọn)
 */

// ───────────────────────── Cấu hình ─────────────────────────

const SH = {
  DANG: '03_DANG_BAI', MA_TRAN: '04_MA_TRAN_PHU', LOG: '06_NHAT_KY', KH: '07_KE_HOACH',
  DUYET: '11_DUYET', PROMPT: '08_PROMPT', KHO: '09_KHO_HINH', YC: '10_YEU_CAU', CHU_DE: '14_CHU_DE_THEO_BAI',
  NGU_LIEU: '15_NGU_LIEU_BO_SUNG', BANK: '20_NGAN_HANG', RAP: '31_RAP_DE', DM: '99_DANH_MUC',
};

const DEFAULTS = {
  GEMINI_TTS_MODEL: 'gemini-2.5-flash-preview-tts',
  VOICE_F: 'Kore', VOICE_M: 'Puck', VOICE_N: 'Charon',
};

const YC_ST = { CHO_TAO: 'Chờ tạo', CHO_SX: 'Chờ sản xuất', CHO_DUYET: 'Chờ duyệt', XONG: 'Hoàn thành', LOI: 'Lỗi' };
const Q_ST = { CHO: 'Chờ duyệt', DAT: 'Đạt', SUA: 'Cần sửa', LOAI: 'Loại' };   // 1 người duyệt duy nhất (tab 11_DUYET)
const QC_VAL = ['Đạt', 'Cần sửa', 'Loại'];

/** Cột thêm vào cuối các tab cũ (caiDat tự tạo nếu thiếu). */
const YC_EXTRA = ['Mã đợt (07_KE_HOACH)', 'Brief cho ChatGPT', 'Kết quả ChatGPT (dán JSON)', 'Lỗi', 'Cập nhật lúc', 'Lượt'];
const BANK_EXTRA = ['Brief sửa cho ChatGPT', 'Kết quả sửa (dán JSON)', 'Prompt vẽ tranh (ChatGPT)'];

const GROUP_TYPES = ['3-3', '4-1', '4-2'];          // 1 audio / bài đọc chung cho 2 câu liên tiếp
const LISTEN_TYPES = ['3-1', '3-2', '3-3'];
const NL_TYPES = ['3-1', '3-2', '3-3', '4-1', '4-2']; // dùng ngữ liệu đã duyệt ở 15
const IMG_TYPES = ['1-1', '3-1', '3-2', '3-3'];      // bắt buộc có hình
const MAX_CAU_LUOT = 20;
const TIME_LIMIT_MS = 4.5 * 60 * 1000;

const KH_CELL = { TU_DONG: 'F2' };
const KH_HEADER_ROW = 4;
const TICK = { HEADER_ROW: 60, FIRST: 61, LAST: 114, FIRST_COL: 4, N_COL: 11 };
const CAP_JP = { 'A1': '入門', 'A2-1': '初級1', 'A2-2': '初級2' };
const LMS_HEADERS = ['Audio Url', 'Content', 'Correct Answer', 'Explanation', 'Image Url',
  'Option 1', 'Option 2', 'Option 3', 'Option 4', 'STT', 'Tag'];

// ───────────────────────── Menu ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎌 JFT')
    .addItem('0. Tạo phiếu từ kế hoạch', 'taoPhieuTuKeHoach')
    .addItem('▶ Chạy ngay (brief, nhận kết quả, QC, gắn hình)', 'chayNgay')
    .addSeparator()
    .addItem('🔊 Tạo audio (Gemini TTS miễn phí)', 'taoAudio')
    .addItem('📁 Mở folder Kho hình', 'moFolderKhoHinh')
    .addItem('📤 Xuất file LMS', 'xuatLMS')
    .addSeparator()
    .addItem('⏱ Bật chạy tự động (5 phút/lần + khi sửa ô)', 'batTuDong')
    .addItem('⏹ Tắt chạy tự động', 'tatTuDong')
    .addItem('⚙ Cài đặt / cập nhật cấu trúc', 'caiDat')
    .addToUi();
}

// ───────────────────────── Tiện ích ─────────────────────────

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || DEFAULTS[k] || ''; }
function ss_() { return SpreadsheetApp.getActive(); }
function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Không thấy sheet ' + name + ' – chạy menu ⚙ Cài đặt');
  return s;
}

/** {sh, head: {tên cột → index 0-based}, rows: [[...]]}; dòng 1 là header. */
function table_(name) {
  const sh = sheet_(name);
  const v = sh.getDataRange().getValues();
  const head = {};
  v[0].forEach((h, i) => { if (h !== '') head[String(h).trim()] = i; });
  return { sh, head, rows: v.slice(1) };
}

/** Index cột theo tiền tố tên header. */
function col_(t, prefix) {
  const k = Object.keys(t.head).find(h => h.indexOf(prefix) === 0);
  if (k === undefined) throw new Error('Không thấy cột "' + prefix + '" – chạy menu ⚙ Cài đặt');
  return t.head[k];
}

function setCell_(t, rowIdx, prefix, v) { t.sh.getRange(rowIdx + 2, col_(t, prefix) + 1).setValue(v); t.rows[rowIdx][col_(t, prefix)] = v; }

function log_(thaoTac, doiTuong, ketQua, chiTiet) {
  sheet_(SH.LOG).appendRow([new Date(), Session.getActiveUser().getEmail() || '(tự động)', thaoTac, doiTuong, ketQua, chiTiet || '']);
}
function toast_(msg) { ss_().toast(msg, 'JFT', 8); }

function lastRowIn_(sh, c) {
  const v = sh.getRange(1, c, sh.getMaxRows(), 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] !== '') return i + 1;
  return 1;
}

function nextId_(rows, c, prefix) {
  let max = 0;
  rows.forEach(r => { const m = String(r[c]).match(new RegExp('^' + prefix + '-(\\d+)$')); if (m) max = Math.max(max, +m[1]); });
  return () => prefix + '-' + String(++max).padStart(4, '0');
}

const baiSo_ = v => Number(String(v).replace(/\D/g, '')) || 0;
const now_ = () => Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm');

/** Ghi một dòng ngân hàng, bỏ qua cột công thức ArrayFormula (Số lần dùng). */
function writeBankRow_(bank, rowNum, row) {
  const skip = col_(bank, 'Số lần dùng');
  bank.sh.getRange(rowNum, 1, 1, skip).setValues([row.slice(0, skip)]);
  if (row.length > skip + 1) bank.sh.getRange(rowNum, skip + 2, 1, row.length - skip - 1).setValues([row.slice(skip + 1)]);
}

// ───────────────────────── Prompt (tab 08) ─────────────────────────

function prompts_() {
  const out = {};
  sheet_(SH.PROMPT).getDataRange().getValues().slice(1).forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1] || ''); });
  return out;
}

const KHUON_JSON = [
  '{"cau_hoi": [{',
  '  "dang": "3-1",',
  '  "nguon": "NL-0010 (mã ngữ liệu / mục nguồn đã dùng)",',
  '  "muc_tieu": "…",',
  '  "yeu_cau_jp": "… (chỉ nhóm 1 và 2-1, còn lại để \\"\\")",',
  '  "yeu_cau_vi": "…",',
  '  "tinh_huong_vi": "… (2-2, 3-x: bắt buộc)",',
  '  "noi_dung": "câu/hội thoại/bài đọc JP; 1-3 đặt từ đích trong 【】; chỗ trống ghi （　）",',
  '  "cau_hoi": "…",',
  '  "lua_chon": ["…", "…", "…"],',
  '  "dap_an": 1,',
  '  "ly_do_nhieu": "…; dạng nghe: 3 dòng \\"① mô tả tranh 1\\n② …\\n③ …\\" (ghi rõ tranh nào là nhiễu từ chi tiết nào)",',
  '  "can_cu": "…",',
  '  "giai_thich_vi": "…",',
  '  "ma_hinh": "H012 hoặc \\"\\" (chỉ mã có trong KHO HÌNH bên trên)",',
  '  "brief_hinh": "mô tả tranh cần vẽ nếu không có ma_hinh; 3-x: 3 khung đánh số 1/2/3",',
  '  "script_audio": "N：…\\nF：…\\nM：… (chỉ dạng nghe)"',
  '}]}',
].join('\n');

// ───────────────────────── 0. Kế hoạch → phiếu ─────────────────────────

function taoPhieuTuKeHoach() {
  const kh = sheet_(SH.KH);
  const n = kh.getLastRow() - KH_HEADER_ROW;
  if (n <= 0) return toast_('07_KE_HOACH chưa có đợt nào.');
  const plans = kh.getRange(KH_HEADER_ROW + 1, 1, n, 13).getValues();
  const mt = sheet_(SH.MA_TRAN);
  const head = mt.getRange(TICK.HEADER_ROW, TICK.FIRST_COL, 1, TICK.N_COL).getValues()[0].map(String);
  const grid = mt.getRange(TICK.FIRST, 1, TICK.LAST - TICK.FIRST + 1, TICK.FIRST_COL - 1 + TICK.N_COL).getValues();
  const dang = table_(SH.DANG);
  const yc = table_(SH.YC);
  const H = yc.head, cDot = col_(yc, 'Mã đợt');
  const exist = new Set(yc.rows.map(r => [r[cDot], r[H['Cấp']], baiSo_(r[H['Bài']]), String(r[H['Dạng']])].join('|')));
  const newYC = nextId_(yc.rows, H['Mã YC'], 'YC');
  let start = lastRowIn_(yc.sh, 1) + 1, tong = 0;

  plans.forEach((p, k) => {
    const [ma, , cap, tu, den, locDang, pool, soCau, , deadline, nguoi, ghiChu, tt] = p;
    if (tt !== 'Duyệt kế hoạch' || !ma || !cap) return;
    const filter = String(locDang).replace(/\s/g, '').split(',').filter(Boolean);
    const out = [], dots = [];
    grid.forEach(g => {
      if (g[0] !== cap || baiSo_(g[1]) < tu || baiSo_(g[1]) > den) return;
      head.forEach((loai, j) => {
        if (g[TICK.FIRST_COL - 1 + j] !== true) return;
        if (filter.length && !filter.includes(loai)) return;
        if (exist.has([ma, cap, baiSo_(g[1]), loai].join('|'))) return;
        const spec = dang.rows.find(d => String(d[0]) === loai) || [];
        const donVi = GROUP_TYPES.includes(loai) ? Math.ceil(soCau / 2) : soCau;
        out.push([newYC(), "'" + loai, pool || 'Luyện tập', '', cap, baiSo_(g[1]), spec[3] || '',
          (spec[7] || '') + (NL_TYPES.includes(loai) ? ' + 15_NGU_LIEU_BO_SUNG' : ''),
          spec[16] || '', donVi, ghiChu || '', nguoi || '', 'ChatGPT', deadline || '', YC_ST.CHO_TAO]);
        dots.push([ma]);
      });
    });
    if (out.length) {
      yc.sh.getRange(start, 1, out.length, out[0].length).setValues(out);
      yc.sh.getRange(start, cDot + 1, dots.length, 1).setValues(dots);
      start += out.length; tong += out.length;
    }
    kh.getRange(KH_HEADER_ROW + 1 + k, 13).setValue('Đã tạo phiếu');
    log_('0. Tạo phiếu', ma, 'OK', out.length + ' phiếu');
  });
  toast_('Đã tạo ' + tong + ' phiếu "Chờ tạo". Script sẽ soạn brief ở lượt chạy tới (hoặc bấm ▶ Chạy ngay).');
}

// ───────────────────────── Vòng chạy ─────────────────────────

function chayNgay() { chayTuDong(); toast_('Xong lượt chạy. Xem 06_NHAT_KY nếu có lỗi.'); }

function chayTuDong() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;                       // đang có lượt khác chạy
  const t0 = Date.now(), het = () => Date.now() - t0 > TIME_LIMIT_MS;
  try {
    ganHinh_();
    const yc = table_(SH.YC), bank = table_(SH.BANK);
    yc.rows.forEach((r, i) => { if (!het() && String(r[col_(yc, 'Kết quả ChatGPT')]).trim()) nhanKetQua_(yc, i, bank); });
    bank.rows.forEach((r, i) => { if (!het() && String(r[col_(bank, 'Kết quả sửa')]).trim()) nhanSua_(bank, i); });
    dongBoDuyet_(bank);
    const ctx = ctx_();
    yc.rows.forEach((r, i) => { if (!het() && r[yc.head['Trạng thái']] === YC_ST.CHO_TAO) soanBrief_(yc, i, bank, ctx); });
    bank.rows.forEach((r, i) => {
      if (!het() && r[col_(bank, 'Trạng thái')] === Q_ST.SUA && !r[col_(bank, 'Brief sửa')]) soanBriefSua_(bank, i, ctx);
    });
    capNhatYC_(yc, bank);
  } finally {
    lock.releaseLock();
  }
}

/** Trigger cài đặt (installable onEdit): xử lý ngay khi dán JSON, chọn QC, gõ mã hình. */
function xuLyKhiSua(e) {
  if (!e || !e.range) return;
  const name = e.range.getSheet().getName(), r = e.range.getRow();
  if (r < 2 || ![SH.YC, SH.BANK, SH.DUYET].includes(name)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const c = e.range.getColumn() - 1;
    if (name === SH.YC) {
      const yc = table_(SH.YC);
      if (c === col_(yc, 'Kết quả ChatGPT')) { const bank = table_(SH.BANK); nhanKetQua_(yc, r - 2, bank); capNhatYC_(yc, bank); }
      return;
    }
    const bank = table_(SH.BANK);
    if (name === SH.DUYET) {                                       // người duyệt chọn Đạt / Cần sửa / Loại
      if (c === DUYET_COL.KQ) { const ctx = ctx_(); dongBoDuyet_(bank).forEach(i => soanBriefSua_(bank, i, ctx)); capNhatYC_(table_(SH.YC), bank); }
      return;
    }
    if (c === col_(bank, 'Kết quả sửa')) nhanSua_(bank, r - 2);
    else if (c === col_(bank, 'Mã asset hình')) ganHinhCau_(bank, r - 2, khoHinh_());
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── Brief ─────────────────────────

/** Dữ liệu dùng chung khi soạn brief (đọc 1 lần mỗi lượt). */
function ctx_() {
  return {
    P: prompts_(),
    dang: table_(SH.DANG),
    chuDe: sheet_(SH.CHU_DE).getDataRange().getValues(),
    nl: sheet_(SH.NGU_LIEU).getDataRange().getValues().slice(1),
    kho: khoHinh_(),
  };
}

function specOf_(ctx, loai) { return ctx.dang.rows.find(d => String(d[0]) === String(loai)); }

function tongCau_(ycRow, yc, spec) { return Number(ycRow[yc.head['Số đơn vị cần sinh']] || 1) * Number(spec[6] || 1); }

function soanBrief_(yc, i, bank, ctx) {
  const r = yc.rows[i], g = k => r[yc.head[k]];
  const ma = g('Mã YC'), loai = String(g('Dạng')), cap = g('Cấp'), bai = baiSo_(g('Bài'));
  const spec = specOf_(ctx, loai);
  const loi = m => { setCell_(yc, i, 'Trạng thái', YC_ST.LOI); setCell_(yc, i, 'Lỗi', m); setCell_(yc, i, 'Cập nhật lúc', now_()); log_('Brief', ma, 'LỖI', m); };
  if (!spec) return loi('Dạng ' + loai + ' không có trong 03_DANG_BAI');

  const daCo = bank.rows.filter(b => b[col_(bank, 'Mã YC')] === ma && b[col_(bank, 'Trạng thái')] !== Q_ST.LOAI);
  const tong = tongCau_(r, yc, spec);
  let canViet = Math.min(tong - daCo.length, MAX_CAU_LUOT);
  if (GROUP_TYPES.includes(loai)) canViet -= canViet % 2;
  if (canViet <= 0) { setCell_(yc, i, 'Trạng thái', YC_ST.CHO_DUYET); return; }

  const nguon = srcItems_(loai, cap, bai);
  const nl = NL_TYPES.includes(loai)
    ? ctx.nl.filter(x => x[1] === cap && baiSo_(x[2]) === bai && String(x[3]) === loai && x[13] === 'Đã duyệt')
      .map(x => '- ' + x[0] + ': ' + [x[5], x[6], x[7], 'Hỏi: ' + x[8], 'Giới hạn: ' + x[10]].join(' | '))
    : [];
  if (NL_TYPES.includes(loai) && !nl.length && !nguon.cur.length) return loi('Bài chưa có ngữ liệu đã duyệt cho dạng ' + loai + ' (15_NGU_LIEU_BO_SUNG)');
  if (!NL_TYPES.includes(loai) && !nguon.cur.length && loai !== '2-2') return loi('Không tìm thấy mục nguồn của bài trong SRC_' + loai);

  const kho = IMG_TYPES.includes(loai)
    ? ctx.kho.filter(h => h.cap === cap && h.bai === bai && h.link)
      .map(h => '- ' + h.ma + ': ' + h.moTa + ' | thể hiện: ' + h.diem + ' | đã dùng ' + h.daDung + ' lần')
    : [];
  const chuDe = ctx.chuDe.find(x => x[0] === cap && baiSo_(x[1]) === bai) || [];
  const cauCu = daCo.map(b => '- ' + String(b[col_(bank, 'Nội dung kiểm tra')]).replace(/\n/g, ' / ').slice(0, 80)).slice(-30);
  const luot = Number(g('Lượt') || 0) + 1;

  const brief = [
    ctx.P['CHUNG'] || '',
    '',
    ctx.P[loai] || '',
    '',
    '=== PHIẾU ' + ma + ' · LƯỢT ' + luot + ' ===',
    'Cấp ' + cap + ' (' + CAP_JP[cap] + ') · Bài ' + bai + ' · Dạng ' + loai + ' – ' + spec[1] + ' (' + spec[3] + ')',
    'VIẾT ĐÚNG ' + canViet + ' CÂU' + (GROUP_TYPES.includes(loai) ? ' = ' + (canViet / 2) + ' nhóm, mỗi nhóm 2 câu liên tiếp dùng chung 1 audio/bài đọc; câu đầu nhóm chứa toàn văn' : '') + '.',
    'Số lựa chọn mỗi câu: ' + spec[5] + ' · Yêu cầu VI chuẩn: ' + spec[16],
    'Tiêu chí duyệt: ' + spec[17],
    'Quy định trình bày: ' + spec[19],
    'GIỚI HẠN (QD-12): chỉ dùng từ vựng, ngữ pháp từ bài 1 đến bài ' + bai + ' của ' + cap + ' (và các cấp trước). Không dùng từ, mẫu câu của bài sau.',
    'Chủ đề bài: ' + (chuDe[2] || '') + ' | Bối cảnh: ' + (chuDe[3] || ''),
    'Can-do: ' + [chuDe[4], chuDe[5]].filter(Boolean).join(' • '),
    g('Ghi chú cho AI / người soạn') ? 'Ghi chú của giáo viên: ' + g('Ghi chú cho AI / người soạn') : '',
    '',
    nguon.cur.length ? 'MỤC NGUỒN CỦA BÀI (chỉ ra câu từ các mục này):\n- ' + nguon.cur.join('\n- ') : '',
    nl.length ? 'NGỮ LIỆU ĐÃ DUYỆT (mỗi câu/nhóm dùng 1 mã, ghi vào "nguon"):\n' + nl.join('\n') : '',
    nguon.prev.length ? 'Từ đã học ở bài trước (được dùng làm phương án nhiễu):\n' + nguon.prev.join('、') : '',
    IMG_TYPES.includes(loai) ? (kho.length ? 'KHO HÌNH IRODORI của bài (ưu tiên dùng, ghi mã vào "ma_hinh"):\n' + kho.join('\n')
      : 'KHO HÌNH: bài này chưa có hình sách → để "ma_hinh": "" và viết "brief_hinh" thật cụ thể.') : '',
    cauCu.length ? 'CÂU ĐÃ CÓ (không viết trùng):\n' + cauCu.join('\n') : '',
    '',
    '=== KHUÔN JSON (trả về DUY NHẤT 1 khối JSON, không viết gì thêm) ===',
    KHUON_JSON,
  ].filter(x => x !== '').join('\n');

  setCell_(yc, i, 'Brief cho ChatGPT', brief);
  setCell_(yc, i, 'Lượt', luot);
  setCell_(yc, i, 'Lỗi', '');
  setCell_(yc, i, 'Trạng thái', YC_ST.CHO_SX);
  setCell_(yc, i, 'Cập nhật lúc', now_());
  log_('Brief', ma, 'OK', 'lượt ' + luot + ', ' + canViet + ' câu');
}

/** Mục nguồn của đúng bài + từ đã học trước đó (làm nhiễu). */
function srcItems_(loai, cap, bai) {
  const rows = name => { const s = ss_().getSheetByName(name); return s ? s.getDataRange().getValues().slice(1) : []; };
  const n = Number(bai), jp = CAP_JP[cap];
  let cur = [], prev = [];
  if (loai === '1-1') {
    const v = rows('SRC_1-1').filter(x => x[0] === cap);
    cur = v.filter(x => baiSo_(x[2]) === n).map(x => x[3] + '（' + x[4] + '）: ' + x[7] + ' – tranh: ' + x[8]);
    prev = v.filter(x => baiSo_(x[2]) < n).map(x => x[3]);
  } else if (loai === '1-2') {
    const v = rows('SRC_1-2').filter(x => x[3] === jp);
    cur = v.filter(x => baiSo_(x[4]) === n).map(x => x[1] + '（' + x[2] + '）: ' + x[5] + ' ' + x[6]);
    prev = v.filter(x => baiSo_(x[4]) < n).map(x => x[1]);
  } else if (loai === '1-3' || loai === '1-4') {
    const v = rows('SRC_' + loai).filter(x => x[7] === jp);
    cur = v.filter(x => baiSo_(x[8]) === n).map(x => x[2] + ' → ' + x[4] + '（' + x[5] + '）');
    prev = v.filter(x => baiSo_(x[8]) < n).map(x => x[4] + '（' + x[5] + '）');
  } else if (loai === '2-1') {
    cur = rows('SRC_2-1').filter(x => x[0] === cap && baiSo_(x[1]) === n && x[4] !== 'Không pick-up')
      .map(x => x[3] + ' [' + x[4] + '] – ' + x[6] + (x[4] === 'Pick-up' ? '' : ' (CÓ ĐIỀU KIỆN: ' + x[7] + ')'));
  } else if (loai === '2-2') {
    cur = rows('SRC_2-2').filter(x => x[1] === cap && baiSo_(x[2]) === n).map(x => x[3] + ' | ' + x[4] + ' | A: ' + x[5] + ' | B: ' + x[6]);
  } else if (loai === '4-1' || loai === '4-2') {
    cur = rows('SRC_4').filter(x => x[0] === cap && baiSo_(x[1]) === n)
      .map(x => x[2] + ' | Nguồn sách: ' + x[3] + ' | ' + x[4] + ' | ' + x[5] + ' | Gợi ý: ' + x[7]);
  }
  return { cur, prev: prev.slice(-150) };
}

// ───────────────────────── Nhận JSON ─────────────────────────

function parseJson_(txt) {
  let s = String(txt).replace(/```(json)?/gi, '').replace(/[“”]/g, '"').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Không thấy khối JSON');
  return JSON.parse(s.slice(a, b + 1));
}

/** Trả về danh sách lỗi của 1 câu (rỗng = đạt). */
function validate_(loai, it, spec, allowedNguon, kho) {
  const e = [];
  const n = Number(spec[5]);
  const lc = (it.lua_chon || []).map(x => String(x).trim()).filter(Boolean);
  if (String(it.dang || loai) !== loai) e.push('dang ≠ ' + loai);
  if (lc.length !== n) e.push('cần đúng ' + n + ' lựa chọn');
  if (new Set(lc).size !== lc.length) e.push('lựa chọn trùng');
  const da = Number(it.dap_an);
  if (!(da >= 1 && da <= n)) e.push('đáp án ngoài 1..' + n);
  if (!it.yeu_cau_vi) e.push('thiếu yeu_cau_vi');
  if (/^(1-|2-1)/.test(loai) && !it.yeu_cau_jp) e.push('thiếu yeu_cau_jp (QD-01)');
  if (!it.giai_thich_vi) e.push('thiếu giai_thich_vi');
  const nd = String(it.noi_dung || '');
  if (loai === '1-3' && !/【.+】/.test(nd)) e.push('1-3 thiếu 【từ đích】');
  if (/^(1-2|1-4|2-1|2-2)$/.test(loai) && !/（\s*）|\(\s*\)/.test(nd)) e.push('thiếu chỗ trống （　）');
  if (LISTEN_TYPES.includes(loai)) {
    if (!it.cau_hoi) e.push('nghe thiếu câu hỏi VI');
    if (!/^\s*[FMN]\s*[:：]/m.test(String(it.script_audio || '')) && !it._nhomSau) e.push('nghe thiếu script_audio (F：/M：/N：)');
  }
  if (IMG_TYPES.includes(loai) && !it.ma_hinh && !it.brief_hinh && !it._nhomSau) e.push('thiếu ma_hinh hoặc brief_hinh');
  if (it.ma_hinh && !kho.some(h => h.ma === it.ma_hinh)) e.push('ma_hinh ' + it.ma_hinh + ' không có trong kho');
  if (allowedNguon.length && !allowedNguon.some(c => String(it.nguon || '').indexOf(c) >= 0)) e.push('nguon không thuộc ngữ liệu trong brief');
  return e;
}

function nhanKetQua_(yc, i, bank) {
  const r = yc.rows[i], ma = r[yc.head['Mã YC']], loai = String(r[yc.head['Dạng']]);
  const raw = r[col_(yc, 'Kết quả ChatGPT')];
  const ctx = ctx_(), spec = specOf_(ctx, loai);
  const loi = m => { setCell_(yc, i, 'Lỗi', m); setCell_(yc, i, 'Cập nhật lúc', now_()); log_('Nhận JSON', ma, 'LỖI', m); };
  let items;
  try {
    const j = parseJson_(raw);
    items = Array.isArray(j) ? j : (j.cau_hoi || j.items || []);
    if (!items.length) throw new Error('JSON không có "cau_hoi"');
  } catch (err) {
    return loi('JSON hỏng (' + err.message + ') – yêu cầu ChatGPT trả lại ĐỦ JSON rồi dán lại');
  }
  if (!spec) return loi('Dạng không hợp lệ');

  const cap = r[yc.head['Cấp']], bai = baiSo_(r[yc.head['Bài']]);
  const allowed = NL_TYPES.includes(loai)
    ? ctx.nl.filter(x => x[1] === cap && baiSo_(x[2]) === bai && String(x[3]) === loai && x[13] === 'Đã duyệt').map(x => x[0]) : [];
  const daCo = bank.rows.filter(b => b[col_(bank, 'Mã YC')] === ma && b[col_(bank, 'Trạng thái')] !== Q_ST.LOAI).length;
  const conThieu = tongCau_(r, yc, spec) - daCo;
  const group = GROUP_TYPES.includes(loai);

  const ok = [], bad = [];
  items.forEach((it, k) => {
    if (group && k % 2 === 1) it._nhomSau = true;               // câu (2) của nhóm dùng chung audio/bài đọc
    const e = validate_(loai, it, spec, allowed, ctx.kho);
    if (e.length) bad.push('câu ' + (k + 1) + ': ' + e.join('; ')); else ok.push(it);
  });
  let nhan = ok.slice(0, Math.max(conThieu, 0));
  if (group) {                                                   // giữ trọn nhóm 2 câu
    const pairs = [];
    for (let k = 0; k + 1 < items.length; k += 2) if (nhan.includes(items[k]) && nhan.includes(items[k + 1])) pairs.push(items[k], items[k + 1]);
    nhan = pairs.slice(0, conThieu - conThieu % 2);
  }

  const newQ = nextId_(bank.rows, col_(bank, 'Mã câu'), 'JQ');
  const newG = nextId_(bank.rows, col_(bank, 'Mã nhóm'), 'G');
  let rowNum = lastRowIn_(bank.sh, 1) + 1, gid = '';
  nhan.forEach((it, k) => {
    if (group && k % 2 === 0) gid = newG();
    const row = bankRowFromItem_(bank, it, r, yc, newQ(), group ? gid : '', ctx);
    writeBankRow_(bank, rowNum++, row);
    bank.rows.push(row);
    choDuyet_(row[col_(bank, 'Mã câu')]);
  });

  setCell_(yc, i, 'Kết quả ChatGPT (dán JSON)', '');
  const conLai = conThieu - nhan.length;
  setCell_(yc, i, 'Trạng thái', conLai > 0 ? YC_ST.CHO_TAO : YC_ST.CHO_DUYET);   // còn thiếu → lượt sau soạn brief mới
  setCell_(yc, i, 'Brief cho ChatGPT', conLai > 0 ? '' : r[col_(yc, 'Brief cho ChatGPT')]);
  setCell_(yc, i, 'Lỗi', bad.length ? 'Bỏ ' + bad.length + ' câu sai khuôn: ' + bad.join(' | ').slice(0, 400) : '');
  setCell_(yc, i, 'Cập nhật lúc', now_());
  log_('Nhận JSON', ma, 'OK', nhan.length + ' câu nhận, ' + bad.length + ' câu bỏ' + (bad.length ? ' – ' + bad.join(' | ') : ''));
}

function bankRowFromItem_(bank, it, ycRow, yc, maCau, gid, ctx) {
  const row = new Array(Math.max(...Object.values(bank.head)) + 1).fill('');
  const set = (p, v) => { row[col_(bank, p)] = v === undefined || v === null ? '' : v; };
  fillContent_(set, it, ycRow[yc.head['Dạng']], ctx);
  set('Mã câu', maCau);
  set('Mã nhóm', gid);
  set('Mã YC', ycRow[yc.head['Mã YC']]);
  set('Dạng', "'" + ycRow[yc.head['Dạng']]);
  set('Pool', ycRow[yc.head['Pool']] || 'Luyện tập');
  set('Cấp', ycRow[yc.head['Cấp']]);
  set('Bài', baiSo_(ycRow[yc.head['Bài']]));
  set('Nguồn', it.nguon || ycRow[yc.head['Nguồn (file / sheet / hàng)']]);
  set('Người soạn', 'ChatGPT');
  set('Loại nguồn', /NL-\d+/.test(String(it.nguon)) ? 'Bổ sung theo chủ đề' : 'Nguồn sách');
  set('Trạng thái', Q_ST.CHO);
  set('Phiên bản', 'v1');
  return row;
}

/** Ghi các cột nội dung (dùng chung cho câu mới và câu sửa). */
function fillContent_(set, it, loai, ctx) {
  const lc = it.lua_chon || [];
  set('Mục tiêu', it.muc_tieu);
  set('Yêu cầu JP', it.yeu_cau_jp);
  set('Yêu cầu VI', it.yeu_cau_vi);
  set('Tình huống JP', it.tinh_huong_jp);
  set('Tình huống VI', it.tinh_huong_vi);
  set('Nội dung kiểm tra', it.noi_dung);
  set('Câu hỏi', it.cau_hoi);
  set('Số lựa chọn', lc.length);
  for (let k = 0; k < 4; k++) set('Lựa chọn ' + (k + 1), lc[k] === undefined ? '' : String(lc[k]));
  set('Đáp án', Number(it.dap_an));
  set('Lý do phương án nhiễu', it.ly_do_nhieu);
  set('Căn cứ đáp án', it.can_cu);
  set('Giải thích VI', it.giai_thich_vi);
  set('Brief hình', it.brief_hinh);
  set('Script audio', it.script_audio);
  set('Mã asset hình', it.ma_hinh || '');
  const h = it.ma_hinh ? ctx.kho.find(x => x.ma === it.ma_hinh) : null;
  set('URL hình', h ? h.link : '');
  set('Prompt vẽ tranh', !it.ma_hinh && it.brief_hinh ? promptVe_(String(loai), it, ctx.P) : '');
}

function promptVe_(loai, it, P) {
  return [P['VE_TRANH'] || '', '', LISTEN_TYPES.includes(loai) ? (P['VE_TRANH_3'] || '') : '', 'NỘI DUNG CẦN VẼ: ' + it.brief_hinh]
    .filter(Boolean).join('\n');
}

// ───────────────────────── QC & vòng sửa ─────────────────────────

/** Tab 11_DUYET: A Mã câu · B–F công thức hiển thị · G DUYỆT (Đạt/Cần sửa/Loại) · H Nhận xét. */
const DUYET_COL = { MA: 0, KQ: 6, NX: 7 };

/** Đưa câu vào hàng chờ duyệt (thêm dòng mới hoặc xoá kết quả duyệt cũ). */
function choDuyet_(ma) {
  const sh = sheet_(SH.DUYET);
  const v = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => r[0]);
  const k = v.indexOf(ma);
  if (k >= 1) sh.getRange(k + 1, DUYET_COL.KQ + 1, 1, 2).setValues([['', '']]);
  else sh.getRange(lastRowIn_(sh, 1) + 1, 1).setValue(ma);
}

/** Đọc 11_DUYET → chuyển trạng thái câu "Chờ duyệt". Trả về index các câu vừa sang "Cần sửa". */
function dongBoDuyet_(bank) {
  const d = sheet_(SH.DUYET).getDataRange().getValues().slice(1);
  const kq = {};
  d.forEach(r => { if (r[DUYET_COL.MA] && QC_VAL.includes(r[DUYET_COL.KQ])) kq[r[DUYET_COL.MA]] = r; });
  const sua = [];
  bank.rows.forEach((r, i) => {
    const x = kq[r[col_(bank, 'Mã câu')]];
    if (!x || r[col_(bank, 'Trạng thái')] !== Q_ST.CHO) return;
    const next = { 'Đạt': Q_ST.DAT, 'Cần sửa': Q_ST.SUA, 'Loại': Q_ST.LOAI }[x[DUYET_COL.KQ]];
    setCell_(bank, i, 'QC VN', x[DUYET_COL.KQ]);
    setCell_(bank, i, 'Nhận xét VN', x[DUYET_COL.NX]);
    setCell_(bank, i, 'Trạng thái', next);
    if (next === Q_ST.SUA) sua.push(i);
  });
  return sua;
}

function itemFromRow_(bank, r) {
  const g = p => r[col_(bank, p)];
  return {
    dang: String(g('Dạng')), nguon: g('Nguồn'), muc_tieu: g('Mục tiêu'), yeu_cau_jp: g('Yêu cầu JP'), yeu_cau_vi: g('Yêu cầu VI'),
    tinh_huong_jp: g('Tình huống JP'), tinh_huong_vi: g('Tình huống VI'), noi_dung: g('Nội dung kiểm tra'), cau_hoi: g('Câu hỏi'),
    lua_chon: [1, 2, 3, 4].map(k => g('Lựa chọn ' + k)).filter(x => x !== ''), dap_an: g('Đáp án'),
    ly_do_nhieu: g('Lý do phương án nhiễu'), can_cu: g('Căn cứ đáp án'), giai_thich_vi: g('Giải thích VI'),
    ma_hinh: g('Mã asset hình'), brief_hinh: g('Brief hình'), script_audio: g('Script audio'),
  };
}

function soanBriefSua_(bank, i, ctx) {
  const r = bank.rows[i], loai = String(r[col_(bank, 'Dạng')]);
  const spec = specOf_(ctx, loai) || [];
  const brief = [
    ctx.P['CHUNG'] || '', '', ctx.P['SUA'] || '', '',
    '=== SỬA CÂU ' + r[col_(bank, 'Mã câu')] + ' · ' + r[col_(bank, 'Cấp')] + ' bài ' + r[col_(bank, 'Bài')] + ' · Dạng ' + loai + ' ===',
    'GIỚI HẠN (QD-12): chỉ dùng từ vựng, ngữ pháp từ bài 1 đến bài ' + r[col_(bank, 'Bài')] + ' của ' + r[col_(bank, 'Cấp')] + '.',
    'Tiêu chí duyệt: ' + (spec[17] || ''),
    'NHẬN XÉT NGƯỜI DUYỆT: ' + (r[col_(bank, 'Nhận xét VN')] || '—'),
    '', 'CÂU HIỆN TẠI (JSON):', JSON.stringify(itemFromRow_(bank, r), null, 1),
    '', '=== TRẢ VỀ: 1 khối JSON {"cau_hoi":[ {1 câu đã sửa, cùng khoá như trên} ]}, không viết gì thêm ===',
  ].join('\n');
  setCell_(bank, i, 'Brief sửa cho ChatGPT', brief);
  log_('Brief sửa', r[col_(bank, 'Mã câu')], 'OK', '');
}

function nhanSua_(bank, i) {
  const r = bank.rows[i], ma = r[col_(bank, 'Mã câu')], loai = String(r[col_(bank, 'Dạng')]);
  const ctx = ctx_(), spec = specOf_(ctx, loai);
  let it;
  try {
    const j = parseJson_(r[col_(bank, 'Kết quả sửa')]);
    it = Array.isArray(j) ? j[0] : (j.cau_hoi ? j.cau_hoi[0] : j);
  } catch (err) {
    setCell_(bank, i, 'Loại lỗi', 'JSON sửa hỏng – dán lại bản đủ');
    return log_('Nhận sửa', ma, 'LỖI', err.message);
  }
  if (r[col_(bank, 'Mã nhóm')] && GROUP_TYPES.includes(loai) && !it.script_audio && !String(it.noi_dung || '').trim()) it._nhomSau = true;
  const e = validate_(loai, it, spec, [], ctx.kho);
  if (e.length) { setCell_(bank, i, 'Loại lỗi', 'Bản sửa sai khuôn: ' + e.join('; ')); return log_('Nhận sửa', ma, 'LỖI', e.join('; ')); }

  const row = r.slice();
  const set = (p, v) => { row[col_(bank, p)] = v === undefined || v === null ? '' : v; };
  fillContent_(set, it, loai, ctx);
  set('Kết quả sửa', ''); set('Brief sửa', ''); set('QC VN', ''); set('Loại lỗi', '');
  set('URL audio', '');                                            // script có thể đã đổi → tạo lại audio
  set('Trạng thái', Q_ST.CHO);
  set('Phiên bản', 'v' + (Number(String(r[col_(bank, 'Phiên bản')]).replace(/\D/g, '')) + 1 || 2));
  writeBankRow_(bank, i + 2, row);
  bank.rows[i] = row;
  choDuyet_(ma);
  log_('Nhận sửa', ma, 'OK', 'về ' + Q_ST.CHO);
}

/** Phiếu "Chờ duyệt" → "Hoàn thành" khi mọi câu đã Đạt/Loại và đủ số câu Đạt. */
function capNhatYC_(yc, bank) {
  const dang = table_(SH.DANG);
  yc.rows.forEach((r, i) => {
    if (r[yc.head['Trạng thái']] !== YC_ST.CHO_DUYET) return;
    const ma = r[yc.head['Mã YC']];
    const qs = bank.rows.filter(b => b[col_(bank, 'Mã YC')] === ma).map(b => b[col_(bank, 'Trạng thái')]);
    const spec = dang.rows.find(d => String(d[0]) === String(r[yc.head['Dạng']])) || [];
    const dat = qs.filter(s => s === Q_ST.DAT).length;
    if (qs.every(s => s === Q_ST.DAT || s === Q_ST.LOAI)) {
      if (dat >= tongCau_(r, yc, spec)) { setCell_(yc, i, 'Trạng thái', YC_ST.XONG); setCell_(yc, i, 'Cập nhật lúc', now_()); }
      else setCell_(yc, i, 'Trạng thái', YC_ST.CHO_TAO);         // bị Loại bớt → tạo bù ở lượt sau
    }
  });
}

// ───────────────────────── Kho hình ─────────────────────────

function khoFolder_() {
  const root = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID'));
  const it = root.getFoldersByName('kho_hinh');
  return it.hasNext() ? it.next() : root.createFolder('kho_hinh');
}
function moFolderKhoHinh() {
  const url = khoFolder_().getUrl();
  SpreadsheetApp.getUi().alert('Folder Kho hình:\n' + url + '\n\nĐặt tên file bắt đầu bằng mã: H001.png (hình Irodori) hoặc JQ-0007.png (tranh ChatGPT vẽ cho câu).');
}

/** [{ma, cap, bai, moTa, diem, link, daDung}] từ tab 09. */
function khoHinh_() {
  const t = table_(SH.KHO);
  const used = {};
  const b = sheet_(SH.BANK).getDataRange().getValues();
  const cH = b[0].findIndex(h => String(h).indexOf('Mã asset hình') === 0);
  b.slice(1).forEach(r => { if (r[cH]) used[r[cH]] = (used[r[cH]] || 0) + 1; });
  return t.rows.filter(r => r[0]).map(r => ({
    ma: String(r[0]).trim(), cap: r[1], bai: baiSo_(r[2]), moTa: r[4], diem: r[5], link: r[col_(t, 'Link hình')], daDung: used[r[0]] || 0,
  }));
}

/** Gắn file trong folder kho_hinh: H001.* → tab 09; JQ-0007.* → câu JQ-0007. */
function ganHinh_() {
  if (!prop_('DRIVE_FOLDER_ID')) return;
  const files = {};
  const it = khoFolder_().getFiles();
  while (it.hasNext()) {
    const f = it.next(), m = f.getName().match(/^(H\d+|JQ-\d+)/i);
    if (m) files[m[1].toUpperCase()] = f;
  }
  const link = f => { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return 'https://drive.google.com/uc?export=view&id=' + f.getId(); };
  const kho = table_(SH.KHO), cL = col_(kho, 'Link hình'), cX = col_(kho, 'Xem hình');
  kho.rows.forEach((r, i) => {
    const f = files[String(r[0]).toUpperCase()];
    if (f && !r[cL]) {
      const u = link(f);
      kho.sh.getRange(i + 2, cL + 1).setValue(u);
      kho.sh.getRange(i + 2, cX + 1).setFormula('=IMAGE("' + u + '")');
    }
  });
  const bank = table_(SH.BANK), k = khoHinh_();
  bank.rows.forEach((r, i) => {
    if (r[col_(bank, 'URL hình')]) return;
    if (r[col_(bank, 'Mã asset hình')]) return ganHinhCau_(bank, i, k);
    const f = files[String(r[col_(bank, 'Mã câu')]).toUpperCase()];
    if (f) { setCell_(bank, i, 'URL hình', link(f)); setCell_(bank, i, 'Mã asset hình', f.getName().replace(/\.\w+$/, '')); }
  });
}

function ganHinhCau_(bank, i, kho) {
  const ma = String(bank.rows[i][col_(bank, 'Mã asset hình')]).trim();
  const h = kho.find(x => x.ma === ma);
  setCell_(bank, i, 'URL hình', h && h.link ? h.link : '');
}

// ───────────────────────── Audio: Gemini TTS (API key miễn phí, không gắn thẻ) ─────────────────────────

function taoAudio() {
  if (!prop_('GEMINI_API_KEY')) return SpreadsheetApp.getUi().alert('Chưa có GEMINI_API_KEY trong Script Properties.\nLấy key miễn phí ở aistudio.google.com › Get API key (KHÔNG bật thanh toán).');
  const bank = table_(SH.BANK);
  const C = p => col_(bank, p);
  const folder = subFolder_('audio');
  const done = {}, t0 = Date.now();
  let n = 0;
  for (let i = 0; i < bank.rows.length; i++) {
    if (Date.now() - t0 > TIME_LIMIT_MS) break;
    const r = bank.rows[i];
    if (![Q_ST.CHO, Q_ST.DAT].includes(r[C('Trạng thái')]) || r[C('URL audio')]) continue;
    if (!LISTEN_TYPES.includes(String(r[C('Dạng')]))) continue;
    const g = r[C('Mã nhóm')];
    if (g && done[g]) { setCell_(bank, i, 'URL audio', done[g]); continue; }
    let script = String(r[C('Script audio')]);
    if (g && !/[FMN]\s*[:：]/.test(script)) {
      const first = bank.rows.find(x => x[C('Mã nhóm')] === g && /[FMN]\s*[:：]/.test(String(x[C('Script audio')])));
      script = first ? String(first[C('Script audio')]) : '';
    }
    if (!/[FMN]\s*[:：]/.test(script)) continue;
    try {
      const f = folder.createFile(geminiTts_(script).setName((g || r[C('Mã câu')]) + '.wav'));
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const url = 'https://drive.google.com/uc?export=download&id=' + f.getId();
      setCell_(bank, i, 'URL audio', url);
      if (g) done[g] = url;
      n++;
    } catch (e) {
      log_('Audio', r[C('Mã câu')], 'LỖI', e.message);
      if (/429|quota|RESOURCE_EXHAUSTED/i.test(e.message)) { toast_('Hết hạn mức miễn phí hôm nay – mai chạy tiếp.'); break; }
    }
  }
  log_('Audio', '20_NGAN_HANG', 'OK', n + ' file');
  toast_('Đã tạo ' + n + ' file audio.');
}

/** Script "N：…/F：…/M：…" → WAV. Lời dẫn N đọc riêng (1 giọng), hội thoại F/M đọc 1 lần (2 giọng). */
function geminiTts_(script) {
  const lines = script.split('\n').map(l => l.match(/^\s*([FMN])\s*[:：]\s*(.+)$/)).filter(Boolean);
  const segs = [];
  lines.forEach(m => {
    const kind = m[1] === 'N' ? 'N' : 'D';
    if (!segs.length || segs[segs.length - 1].kind !== kind) segs.push({ kind, lines: [] });
    segs[segs.length - 1].lines.push(m);
  });
  const pause = new Array(24000 * 2 * 0.8).fill(0);                // 0,8 giây im lặng (24 kHz, 16-bit)
  let pcm = [];
  segs.forEach((s, k) => {
    const speakers = [...new Set(s.lines.map(m => m[1]))];
    let text, speech;
    if (speakers.length === 1) {
      text = 'ゆっくり、はっきり読んでください：\n' + s.lines.map(m => m[2]).join('\n');
      speech = { voiceConfig: { prebuiltVoiceConfig: { voiceName: prop_('VOICE_' + speakers[0]) } } };
    } else {
      text = 'TTS the following Japanese conversation between F and M, natural speed for learners:\n' + s.lines.map(m => m[1] + ': ' + m[2]).join('\n');
      speech = { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map(sp => ({ speaker: sp, voiceConfig: { prebuiltVoiceConfig: { voiceName: prop_('VOICE_' + sp) } } })) } };
    }
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + prop_('GEMINI_TTS_MODEL') + ':generateContent?key=' + prop_('GEMINI_API_KEY'), {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: speech } }),
    });
    if (res.getResponseCode() !== 200) throw new Error('Gemini TTS ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
    const data = JSON.parse(res.getContentText()).candidates[0].content.parts[0].inlineData.data;
    if (k) pcm = pcm.concat(pause);
    pcm = pcm.concat(Utilities.base64Decode(data));
  });
  return Utilities.newBlob(wav_(pcm, 24000), 'audio/wav');
}

/** PCM 16-bit mono → WAV (byte[] có dấu như Apps Script). */
function wav_(pcm, rate) {
  const h = [], str = s => s.split('').forEach(c => h.push(c.charCodeAt(0)));
  const u32 = v => { for (let k = 0; k < 4; k++) h.push((v >> (8 * k)) & 255); };
  const u16 = v => { h.push(v & 255, (v >> 8) & 255); };
  str('RIFF'); u32(36 + pcm.length); str('WAVE'); str('fmt '); u32(16); u16(1); u16(1); u32(rate); u32(rate * 2); u16(2); u16(16);
  str('data'); u32(pcm.length);
  return h.map(b => (b > 127 ? b - 256 : b)).concat(pcm);
}

function subFolder_(name) {
  const root = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID'));
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// ───────────────────────── Xuất LMS ─────────────────────────

function xuatLMS() {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('Xuất file LMS', 'Nhập mã đề (VD: DT-01), bài luyện (VD: A1-05) hoặc mã phiếu (VD: YC-0003):', ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return;
  const res = xuatLMS_(ans.getResponseText().trim());
  ui.alert(res.msg);
}

function xuatLMS_(key) {
  const b = table_(SH.BANK);
  const C = p => col_(b, p);
  const dat = r => r[C('Trạng thái')] === Q_ST.DAT;
  let list;
  const m = key.match(/^(A1|A2-1|A2-2)-(\d{1,2})$/);
  if (m) list = b.rows.filter(r => dat(r) && r[C('Cấp')] === m[1] && baiSo_(r[C('Bài')]) === Number(m[2]) && r[C('Pool')] === 'Luyện tập');
  else if (/^YC-/.test(key)) list = b.rows.filter(r => dat(r) && r[C('Mã YC')] === key);
  else {
    const byId = {};
    b.rows.forEach(r => { byId[r[C('Mã câu')]] = r; });
    const rap = table_(SH.RAP);
    list = rap.rows.filter(r => r[rap.head['Mã đề']] === key).sort((x, y) => x[rap.head['STT']] - y[rap.head['STT']])
      .map(r => byId[r[rap.head['Mã câu']]]).filter(r => r && dat(r));
  }
  if (!list.length) return { msg: 'Không có câu "Đạt" cho "' + key + '".', rows: [] };

  const thieu = list.filter(r => (LISTEN_TYPES.includes(String(r[C('Dạng')])) && !r[C('URL audio')])
    || (IMG_TYPES.includes(String(r[C('Dạng')])) && !r[C('URL hình')])).map(r => r[C('Mã câu')]);

  const groupText = {};
  b.rows.forEach(r => { const g = r[C('Mã nhóm')], t = stripTag_(r[C('Nội dung kiểm tra')]); if (g && t && !groupText[g]) groupText[g] = t; });

  const out = [LMS_HEADERS];
  list.forEach((r, k) => {
    const loai = String(r[C('Dạng')]), lines = [];
    if (r[C('Yêu cầu VI')]) lines.push(r[C('Yêu cầu VI')]);
    if (r[C('Yêu cầu JP')] && /^(1-|2-1)/.test(loai)) lines.push(r[C('Yêu cầu JP')]);
    if (r[C('Tình huống VI')]) lines.push(r[C('Tình huống VI')]);
    const nd = stripTag_(r[C('Nội dung kiểm tra')]) || (r[C('Mã nhóm')] ? groupText[r[C('Mã nhóm')]] : '');
    if (nd && !LISTEN_TYPES.includes(loai)) lines.push(nd);
    if (r[C('Câu hỏi')]) lines.push(r[C('Câu hỏi')]);
    const tag = ['JFT', loai, r[C('Cấp')] + '-' + String(r[C('Bài')]).padStart(2, '0'), r[C('Mã câu')]].join('|');
    out.push([r[C('URL audio')] || '', lines.join('\n'), r[C('Đáp án')], r[C('Giải thích VI')], r[C('URL hình')] || '',
      r[C('Lựa chọn 1')], r[C('Lựa chọn 2')], r[C('Lựa chọn 3')], r[C('Lựa chọn 4')] || '', k + 1, tag]);
  });

  const tmp = SpreadsheetApp.create('LMS_' + key + '_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmm'));
  const s = tmp.getSheets()[0].setName('MULTIPLE CHOICE (Advanced)');
  s.getRange(1, 1, out.length, LMS_HEADERS.length).setNumberFormat('@').setValues(out);
  SpreadsheetApp.flush();
  const xlsx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(tmp.getName() + '.xlsx');
  const file = subFolder_('exports').createFile(xlsx);
  DriveApp.getFileById(tmp.getId()).setTrashed(true);
  log_('Xuất LMS', key, 'OK', (out.length - 1) + ' câu → ' + file.getUrl() + (thieu.length ? ' | thiếu media: ' + thieu.join(', ') : ''));
  return { msg: 'Đã xuất ' + (out.length - 1) + ' câu.\n' + file.getUrl() + (thieu.length ? '\n⚠ Thiếu audio/hình: ' + thieu.join(', ') : ''), rows: out };
}

function stripTag_(s) { return String(s || '').split('\n').filter(l => !/^\s*\[.*\]\s*$/.test(l)).join('\n').trim(); }

// ───────────────────────── Chạy tự động ─────────────────────────

function batTuDong() {
  tatTuDong(true);
  ScriptApp.newTrigger('chayTuDong').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('xuLyKhiSua').forSpreadsheet(ss_()).onEdit().create();
  sheet_(SH.KH).getRange(KH_CELL.TU_DONG).setValue('Bật');
  log_('Tự động', 'trigger', 'Bật', '5 phút/lần + khi sửa ô');
  toast_('Đã bật chạy tự động.');
}

function tatTuDong(silent) {
  ScriptApp.getProjectTriggers().filter(t => ['chayTuDong', 'xuLyKhiSua'].includes(t.getHandlerFunction())).forEach(t => ScriptApp.deleteTrigger(t));
  if (silent === true) return;
  sheet_(SH.KH).getRange(KH_CELL.TU_DONG).setValue('Tắt');
  log_('Tự động', 'trigger', 'Tắt', '');
  toast_('Đã tắt chạy tự động.');
}

// ───────────────────────── Cài đặt (chạy 1 lần, chạy lại an toàn) ─────────────────────────

function caiDat() {
  const ss = ss_();
  const ensureCols = (name, cols) => {
    const sh = sheet_(name);
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    cols.forEach(c => {
      if (head.some(h => h.indexOf(c.split(' (')[0]) === 0)) return;
      if (sh.getMaxColumns() <= head.length) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
      sh.getRange(1, head.length + 1).setValue(c).setFontWeight('bold');
      head.push(c);
    });
  };
  ensureCols(SH.YC, YC_EXTRA);
  ensureCols(SH.BANK, BANK_EXTRA);

  if (!ss.getSheetByName(SH.PROMPT)) {
    const p = ss.insertSheet(SH.PROMPT);
    p.getRange(1, 1, 1, 3).setValues([['Mã', 'Nội dung prompt (sửa trực tiếp, script đọc mỗi lần soạn brief)', 'Ghi chú']]).setFontWeight('bold');
  }
  if (!ss.getSheetByName(SH.KHO)) {
    const k = ss.insertSheet(SH.KHO);
    k.getRange(1, 1, 1, 9).setValues([['Mã hình', 'Cấp', 'Bài', 'Nguồn (sách, trang)', 'Mô tả hình', 'Từ / điểm thể hiện', 'Link hình', 'Xem hình', 'Ghi chú']]).setFontWeight('bold');
  }

  // Dropdown
  const dv = list => SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  const yc = table_(SH.YC), bank = table_(SH.BANK);
  yc.sh.getRange(2, yc.head['Trạng thái'] + 1, yc.sh.getMaxRows() - 1, 1).setDataValidation(dv(Object.values(YC_ST)));
  bank.sh.getRange(2, col_(bank, 'Trạng thái') + 1, bank.sh.getMaxRows() - 1, 1).setDataValidation(dv(Object.values(Q_ST)));
  if (!ss.getSheetByName(SH.DUYET)) {
    const d = ss.insertSheet(SH.DUYET, 0);
    d.getRange(1, 1, 1, 8).setValues([['Mã câu', 'Đề · Dạng · Bài', 'Câu hỏi (như học viên thấy)', 'Đáp án', 'Giải thích', 'Script audio / Tranh cần vẽ', 'DUYỆT', 'Nhận xét (bắt buộc khi Cần sửa)']]).setFontWeight('bold');
    const L = "LET(r,MATCH(m,'20_NGAN_HANG'!A:A,0),g,LAMBDA(c,INDEX('20_NGAN_HANG'!A:AR,r,c)),";
    d.getRange('B2').setFormula('=MAP(A2:A1000,LAMBDA(m,IF(m="",,' + L + 'g(3)&" · "&g(4)&" · "&g(6)&" bài "&g(7)))))');
    d.getRange('C2').setFormula('=MAP(A2:A1000,LAMBDA(m,IF(m="",,' + L + 'nghe,LEFT(g(4),2)="3-",nd,IF(AND(g(14)="",g(2)<>""),"〔dùng chung với câu (1)〕"&CHAR(10)&INDEX(\'20_NGAN_HANG\'!N:N,MATCH(g(2),\'20_NGAN_HANG\'!B:B,0)),g(14)&""),TEXTJOIN(CHAR(10),TRUE,g(11),g(10),IF(g(13)="","","▶ "&g(13)),IF(OR(nd="[Tranh]",nd="[Audio]",nghe),"",REGEXREPLACE(nd,"\\[[^\\]]*\\]\\n?","")),g(15),IF(nghe,"TRANH LỰA CHỌN:"&CHAR(10)&g(22),TEXTJOIN(CHAR(10),TRUE,"① "&g(17),"② "&g(18),"③ "&g(19),IF(g(20)="","","④ "&g(20))))))))))');
    d.getRange('D2').setFormula('=MAP(A2:A1000,LAMBDA(m,IF(m="",,' + L + 'IF(LEFT(g(4),2)="3-",INDEX(SPLIT(g(22),CHAR(10)),1,g(21)),g(21)&" → "&g(16+g(21)))))))');
    d.getRange('E2').setFormula('=MAP(A2:A1000,LAMBDA(m,IF(m="",,' + L + 'g(24)))))');
    d.getRange('F2').setFormula('=MAP(A2:A1000,LAMBDA(m,IF(m="",,' + L + 's,IF(AND(g(28)="",g(2)<>"",LEFT(g(4),2)="3-"),"〔dùng chung audio câu (1)〕"&CHAR(10)&INDEX(\'20_NGAN_HANG\'!AB:AB,MATCH(g(2),\'20_NGAN_HANG\'!B:B,0)),g(28)),TEXTJOIN(CHAR(10)&"—"&CHAR(10),TRUE,s,IF(g(25)="","","🖼 "&g(25)))))))');
    d.getRange(2, 7, 999, 1).setDataValidation(dv(QC_VAL));
    d.setFrozenRows(1);
  }

  // Chuyển trạng thái cũ (v2) sang bộ trạng thái mới
  const mapQ = { 'Draft': Q_ST.CHO, 'Đang QC VN': Q_ST.CHO, 'Đang QC JP': Q_ST.CHO, 'Chờ QC VN': Q_ST.CHO, 'Chờ QC JP': Q_ST.CHO, 'Approved': Q_ST.DAT, 'Trả về': Q_ST.SUA };
  const mapYC = { 'Nháp': YC_ST.CHO_TAO, 'Sẵn sàng sinh': YC_ST.CHO_TAO, 'Đã sinh': YC_ST.CHO_DUYET, 'Huỷ': YC_ST.LOI };
  bank.rows.forEach((r, i) => { const v = mapQ[r[col_(bank, 'Trạng thái')]]; if (v) setCell_(bank, i, 'Trạng thái', v); });
  yc.rows.forEach((r, i) => { const v = mapYC[r[yc.head['Trạng thái']]]; if (v) setCell_(yc, i, 'Trạng thái', v); });
  log_('Cài đặt', '—', 'OK', 'cấu trúc v3');
  toast_('Đã cài đặt. Bước tiếp: ⏱ Bật chạy tự động.');
}
