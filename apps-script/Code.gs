/**
 * JFT Irodori – Luồng tự động (v2)
 * Gắn vào Google Sheet "JFT Irodori – Hệ thống luyện thi (theo tiêu chuẩn 11 dạng)".
 *
 * Menu 🎌 JFT:
 *   0. Tạo phiếu từ kế hoạch  07_KE_HOACH (Duyệt kế hoạch) × ô đã tick ở 04 → 10_YEU_CAU (Sẵn sàng sinh)
 *   1. Sinh câu từ phiếu      10_YEU_CAU (Sẵn sàng sinh) → ChatGPT / Claude → 20_NGAN_HANG (Draft)
 *   2. Tự kiểm tra câu Draft   luật cứng → Đang QC VN / Trả về
 *   3. Chuyển trạng thái QC    đọc cột QC VN / QC JP → Đang QC JP / Approved / Trả về / Loại
 *   4. Tạo audio               Script audio (F:/M:/N:) → Google Cloud TTS → Drive → URL audio
 *   5. Xuất file LMS           Mã đề (31_RAP_DE) hoặc bài luyện (A1-05) → .xlsx "MULTIPLE CHOICE (Advanced)"
 *
 * Script Properties: AI_PROVIDER, OPENAI_API_KEY, OPENAI_MODEL, CLAUDE_API_KEY, CLAUDE_MODEL,
 *                    GCP_TTS_API_KEY, TTS_VOICE_F, TTS_VOICE_M, TTS_VOICE_N, DRIVE_FOLDER_ID
 */

const SH = {
  DANG: '03_DANG_BAI',
  CHU_DE: '14_CHU_DE_THEO_BAI',
  NGU_LIEU: '15_NGU_LIEU_BO_SUNG',
  YC: '10_YEU_CAU',
  BANK: '20_NGAN_HANG',
  RAP: '31_RAP_DE',
  QD: '90_QUYET_DINH',
  LOG: '06_NHAT_KY',
  KH: '07_KE_HOACH',
  MA_TRAN: '04_MA_TRAN_PHU',
};

/** Ô cài đặt trên 07_KE_HOACH */
const KH_CELL = { MAX_CAU: 'D2', TU_DONG: 'F2' };
const KH_HEADER_ROW = 4;

/** 04_MA_TRAN_PHU: bảng "Bật ra đề?" – header dòng 60, dữ liệu 61–114, cột A Cấp, B Bài, D..N 11 dạng */
const TICK = { HEADER_ROW: 60, FIRST: 61, LAST: 114, FIRST_COL: 4, N_COL: 11 };

const DEFAULTS = {
  AI_PROVIDER: 'openai',
  OPENAI_MODEL: 'gpt-4.1',
  CLAUDE_MODEL: 'claude-sonnet-5-5',
  TTS_VOICE_F: 'ja-JP-Neural2-B',
  TTS_VOICE_M: 'ja-JP-Neural2-C',
  TTS_VOICE_N: 'ja-JP-Neural2-D',
};

const GROUP_TYPES = ['3-3', '4-1', '4-2'];        // 1 nhóm nguồn + 2 câu
const LISTEN_TYPES = ['3-1', '3-2', '3-3'];
const LMS_HEADERS = ['Audio Url', 'Content', 'Correct Answer', 'Explanation', 'Image Url',
  'Option 1', 'Option 2', 'Option 3', 'Option 4', 'STT', 'Tag'];

// ───────────────────────── Menu ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎌 JFT')
    .addItem('0. Tạo phiếu từ kế hoạch', 'taoPhieuTuKeHoach')
    .addItem('1. Sinh câu từ phiếu', 'sinhCauTuPhieu')
    .addItem('2. Tự kiểm tra câu Draft', 'tuKiemTra')
    .addItem('3. Chuyển trạng thái QC', 'chuyenTrangThaiQC')
    .addSeparator()
    .addItem('4. Tạo audio', 'taoAudio')
    .addItem('5. Xuất file LMS', 'xuatLMS')
    .addSeparator()
    .addItem('⏱ Bật chạy tự động mỗi giờ (sinh + tự kiểm tra)', 'batTuDong')
    .addItem('⏹ Tắt chạy tự động', 'tatTuDong')
    .addToUi();
}

// ───────────────────────── Tiện ích ─────────────────────────

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || DEFAULTS[k] || '';
}

/** Đọc sheet thành {sh, head: {tên cột: index}, rows: [[...]]}; dòng 1 là header. */
function table_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Không thấy sheet ' + name);
  const v = sh.getDataRange().getValues();
  const head = {};
  v[0].forEach((h, i) => { if (h !== '') head[String(h).trim()] = i; });
  return { sh, head, rows: v.slice(1) };
}

/** Tìm index cột theo tiền tố tên header (header 20_NGAN_HANG dài, có chú thích trong ngoặc). */
function col_(t, prefix) {
  const k = Object.keys(t.head).find(h => h.indexOf(prefix) === 0);
  if (k === undefined) throw new Error('Không thấy cột "' + prefix + '"');
  return t.head[k];
}

function log_(thaoTac, doiTuong, ketQua, chiTiet) {
  SpreadsheetApp.getActive().getSheetByName(SH.LOG).appendRow([
    new Date(), Session.getActiveUser().getEmail() || '(ẩn)', thaoTac, doiTuong, ketQua, chiTiet || '']);
}

/** Dòng cuối có dữ liệu ở cột c (bỏ qua cột công thức ArrayFormula chạy tới cuối sheet). */
function lastRowIn_(sh, c) {
  const v = sh.getRange(1, c, sh.getMaxRows(), 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] !== '') return i + 1;
  return 1;
}

function toast_(msg) { SpreadsheetApp.getActive().toast(msg, 'JFT', 8); }

function nextId_(t, c, prefix) {
  let max = 0;
  t.rows.forEach(r => {
    const m = String(r[c]).match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (m) max = Math.max(max, +m[1]);
  });
  return () => prefix + '-' + String(++max).padStart(4, '0');
}

// ───────────────────────── 1. Sinh câu ─────────────────────────

function sinhCauTuPhieu() {
  const yc = table_(SH.YC);
  const cTT = yc.head['Trạng thái'];
  const jobs = yc.rows.map((r, i) => ({ r, i })).filter(x => x.r[cTT] === 'Sẵn sàng sinh');
  if (!jobs.length) return toast_('Không có phiếu "Sẵn sàng sinh".');

  const dang = table_(SH.DANG);
  const bank = table_(SH.BANK);
  const newQ = nextId_(bank, col_(bank, 'Mã câu'), 'JQ');
  const newG = nextId_(bank, col_(bank, 'Mã nhóm'), 'G');
  const started = Date.now();
  const maxCau = Number(SpreadsheetApp.getActive().getSheetByName(SH.KH).getRange(KH_CELL.MAX_CAU).getValue()) || 30;
  let done = 0, soCau = 0;

  for (const { r, i } of jobs) {
    if (Date.now() - started > 4.5 * 60 * 1000) break;          // chừa thời gian trước giới hạn 6 phút
    if (soCau >= maxCau) break;                                  // chặn chi phí: tối đa câu / lần chạy (07_KE_HOACH!D2)
    const maYC = r[yc.head['Mã YC']];
    try {
      const spec = dang.rows.find(d => String(d[0]) === String(r[yc.head['Dạng']]));
      if (!spec) throw new Error('Dạng không có trong 03_DANG_BAI');
      const items = callAI_(buildPrompt_(yc, r, dang, spec));
      const rows = items.map(it => bankRow_(bank, it, r, yc, newQ));
      if (GROUP_TYPES.includes(String(spec[0]))) {               // gán mã nhóm: mỗi 2 câu 1 nhóm
        for (let k = 0; k < rows.length; k += 2) {
          const g = newG();
          rows[k][col_(bank, 'Mã nhóm')] = g;
          if (rows[k + 1]) rows[k + 1][col_(bank, 'Mã nhóm')] = g;
        }
      }
      if (rows.length) bank.sh.getRange(lastRowIn_(bank.sh, 1) + 1, 1, rows.length, rows[0].length).setValues(rows);
      soCau += rows.length;
      yc.sh.getRange(i + 2, cTT + 1).setValue('Đã sinh');
      log_('1. Sinh câu', maYC, 'OK', rows.length + ' câu, ' + prop_('AI_PROVIDER'));
      done++;
    } catch (e) {
      log_('1. Sinh câu', maYC, 'LỖI', e.message);
    }
  }
  toast_('Đã xử lý ' + done + '/' + jobs.length + ' phiếu (' + soCau + ' câu). Xem 06_NHAT_KY. Chạy tiếp khâu 2.');
}

/** spec = 1 dòng 03_DANG_BAI (đọc theo vị trí: F số lựa chọn, G số câu/đơn vị, Q yêu cầu VI, R tiêu chí, T quy định). */
function buildPrompt_(yc, r, dang, spec) {
  const g = k => r[yc.head[k]];
  const cap = g('Cấp'), bai = g('Bài'), loai = String(spec[0]);
  const chuDe = SpreadsheetApp.getActive().getSheetByName(SH.CHU_DE).getDataRange().getValues()
    .find(x => x[0] === cap && String(x[1]) === String(bai)) || [];
  const nl = LISTEN_TYPES.concat(['4-1', '4-2']).includes(loai)
    ? SpreadsheetApp.getActive().getSheetByName(SH.NGU_LIEU).getDataRange().getValues()
        .filter(x => x[1] === cap && String(x[2]) === String(bai) && String(x[3]) === loai && x[13] === 'Đã duyệt')
        .map(x => '- ' + x[0] + ': ' + [x[5], x[6], x[7], 'Hỏi: ' + x[8]].join(' | ')).join('\n')
    : '';
  const soLC = spec[5], soCau = Number(g('Số đơn vị cần sinh') || 1) * Number(spec[6] || 1);

  const system = [
    'Bạn là chuyên gia ra đề JFT-Basic, giới hạn trong giáo trình いろどり (Irodori).',
    'Luật bắt buộc:',
    '- QD-12: chỉ dùng từ vựng/ngữ pháp từ bài 1 đến bài ' + bai + ' của cấp ' + cap + ' (và các cấp trước). Không dùng từ, mẫu câu của bài sau. Ngoại lệ: tên riêng, số, giờ.',
    '- QD-01: nhóm 1 và 2-1 có yêu cầu song ngữ (VI trước, JP sau); 2-2, nghe, đọc chỉ yêu cầu VI.',
    '- QD-03: hội thoại dạng text, mỗi lượt một dòng "A：…" / "B：…".',
    '- QD-04/06: nghe: tình huống + câu hỏi VI hiện trên đề; lựa chọn là tranh đánh số 1/2/3 (lựa chọn ghi "1","2","3"), mô tả 3 tranh trong brief_hinh.',
    '- Script audio: mỗi lượt một dòng, nhãn F: (nữ) / M: (nam) / N: (người dẫn).',
    '- Chỉ một đáp án đúng; nhiễu cùng loại, hợp lý nhưng sai rõ.',
    '- Tiếng Nhật tự nhiên, đúng trợ từ; dùng kana/kanji đúng mức bài.',
    'Trả về DUY NHẤT một JSON object {"items":[...]} không kèm giải thích.',
  ].join('\n');

  const user = [
    'DẠNG ' + loai + ' – ' + spec[1] + ' (' + spec[3] + ')',
    'Đơn vị nội dung: ' + spec[4] + ' | Số lựa chọn: ' + soLC,
    'Yêu cầu VI chuẩn: ' + spec[16],
    'Tiêu chí duyệt: ' + spec[17],
    'Quy định trình bày: ' + spec[19],
    '',
    'PHIẾU ' + g('Mã YC') + ': ' + cap + ' bài ' + bai,
    'Mục tiêu: ' + g('Mục tiêu chính'),
    'Nguồn: ' + g('Nguồn (file / sheet / hàng)'),
    'Tình huống & yêu cầu: ' + g('Tình huống & yêu cầu (ghi rõ ngôn ngữ)'),
    'Ghi chú: ' + g('Ghi chú cho AI / người soạn'),
    'Chủ đề bài: ' + (chuDe[2] || '') + ' | Bối cảnh: ' + (chuDe[3] || '') + ' | Can-do: ' + (chuDe[4] || '') + ' ' + (chuDe[5] || ''),
    nl ? 'Ngữ liệu bổ sung đã duyệt (chọn từ đây):\n' + nl : '',
    srcItems_(loai, cap, bai),
    '',
    'Sinh đúng ' + soCau + ' câu' + (GROUP_TYPES.includes(loai) ? ' (mỗi 2 câu liên tiếp dùng chung 1 audio/bài đọc; câu đầu của nhóm chứa toàn văn trong noi_dung hoặc script_audio)' : '') + '.',
    'Mỗi item có các khoá: muc_tieu, yeu_cau_jp, yeu_cau_vi, tinh_huong_jp, tinh_huong_vi, noi_dung, cau_hoi,',
    'lua_chon (mảng ' + soLC + ' chuỗi), dap_an (số 1..' + soLC + '), ly_do_nhieu, can_cu, giai_thich_vi, brief_hinh, script_audio.',
    'Trường không dùng để "". Từ đích dạng 1-3 đặt trong 【】.',
  ].filter(Boolean).join('\n');
  return { system, user };
}

function callAI_(p) {
  const provider = prop_('AI_PROVIDER').toLowerCase();
  let text;
  if (provider === 'claude') {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': prop_('CLAUDE_API_KEY'), 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: prop_('CLAUDE_MODEL'), max_tokens: 8000, system: p.system,
        messages: [{ role: 'user', content: p.user }] }),
    });
    const j = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200) throw new Error('Claude API: ' + res.getContentText().slice(0, 300));
    text = j.content.map(c => c.text || '').join('');
  } else {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + prop_('OPENAI_API_KEY') },
      payload: JSON.stringify({ model: prop_('OPENAI_MODEL'), response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }] }),
    });
    const j = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200) throw new Error('OpenAI API: ' + res.getContentText().slice(0, 300));
    text = j.choices[0].message.content;
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI không trả JSON');
  const items = JSON.parse(m[0]).items;
  if (!Array.isArray(items) || !items.length) throw new Error('JSON không có items');
  return items;
}

function bankRow_(bank, it, r, yc, newQ) {
  const row = new Array(Math.max(...Object.values(bank.head)) + 1).fill('');
  const set = (prefix, v) => { row[col_(bank, prefix)] = v === undefined ? '' : v; };
  const lc = it.lua_chon || [];
  set('Mã câu', newQ());
  set('Mã YC', r[yc.head['Mã YC']]);
  set('Dạng', "'" + r[yc.head['Dạng']]);
  set('Pool', r[yc.head['Pool']] || 'Luyện tập');
  set('Cấp', r[yc.head['Cấp']]);
  set('Bài', r[yc.head['Bài']]);
  set('Mục tiêu', it.muc_tieu);
  set('Nguồn', r[yc.head['Nguồn (file / sheet / hàng)']]);
  set('Yêu cầu JP', it.yeu_cau_jp);
  set('Yêu cầu VI', it.yeu_cau_vi);
  set('Tình huống JP', it.tinh_huong_jp);
  set('Tình huống VI', it.tinh_huong_vi);
  set('Nội dung kiểm tra', it.noi_dung);
  set('Câu hỏi', it.cau_hoi);
  set('Số lựa chọn', lc.length);
  for (let k = 0; k < 4; k++) set('Lựa chọn ' + (k + 1), lc[k] || '');
  set('Đáp án', Number(it.dap_an));
  set('Lý do phương án nhiễu', it.ly_do_nhieu);
  set('Căn cứ đáp án', it.can_cu);
  set('Giải thích VI', it.giai_thich_vi);
  set('Brief hình', it.brief_hinh);
  set('Script audio', it.script_audio);
  set('Người soạn', (prop_('AI_PROVIDER') || 'openai') + ' (Apps Script)');
  set('Loại nguồn', /NL-\d+/.test(String(r[yc.head['Nguồn (file / sheet / hàng)']])) ? 'Bổ sung theo chủ đề' : 'Nguồn sách');
  set('Trạng thái', 'Draft');
  set('Phiên bản', 'v1');
  return row;
}

// ───────────────────────── 2. Tự kiểm tra ─────────────────────────

function tuKiemTra() {
  const b = table_(SH.BANK);
  const dang = table_(SH.DANG);
  const C = p => col_(b, p);
  const cTT = C('Trạng thái'), cLoi = C('Loại lỗi'), cNX = C('Nhận xét VN');
  const seen = {};
  b.rows.forEach(r => { const k = String(r[C('Nội dung kiểm tra')]) + '|' + r[C('Câu hỏi')]; seen[k] = (seen[k] || 0) + 1; });

  let ok = 0, bad = 0;
  b.rows.forEach((r, i) => {
    if (r[cTT] !== 'Draft') return;
    const loai = String(r[C('Dạng')]);
    const spec = dang.rows.find(d => String(d[0]) === loai);
    const err = [];
    if (!spec) err.push('Dạng không hợp lệ');
    const n = Number(r[C('Số lựa chọn')]);
    const opts = [1, 2, 3, 4].map(k => String(r[C('Lựa chọn ' + k)]).trim()).filter(Boolean);
    if (spec && n !== Number(spec[5])) err.push('Số lựa chọn phải là ' + spec[5]);
    if (opts.length !== n) err.push('Số lựa chọn điền (' + opts.length + ') ≠ ' + n);
    if (new Set(opts).size !== opts.length) err.push('Lựa chọn trùng nhau');
    const da = Number(r[C('Đáp án')]);
    if (!(da >= 1 && da <= n)) err.push('Đáp án ngoài 1..' + n);
    if (!r[C('Yêu cầu VI')]) err.push('Thiếu yêu cầu VI');
    if (/^(1-|2-1)/.test(loai) && !r[C('Yêu cầu JP')]) err.push('Thiếu yêu cầu JP (QD-01)');
    if (loai === '1-3' && !/【.+】/.test(r[C('Nội dung kiểm tra')])) err.push('1-3 thiếu từ đích 【】');
    if (/^1-[24]|2-[12]/.test(loai) && !/（\s*）|\(\s*\)/.test(r[C('Nội dung kiểm tra')])) err.push('Thiếu chỗ trống （　）');
    if (LISTEN_TYPES.includes(loai)) {
      if (!r[C('Câu hỏi')]) err.push('Nghe thiếu câu hỏi VI');
      if (!r[C('Script audio')]) err.push('Nghe thiếu script audio');
      if (!r[C('Brief hình')]) err.push('Nghe thiếu brief 3 tranh');
    }
    if (loai === '1-1' && !r[C('Brief hình')]) err.push('1-1 thiếu brief hình');
    if (GROUP_TYPES.includes(loai) && !r[C('Mã nhóm')]) err.push('Thiếu mã nhóm');
    if (!r[C('Giải thích VI')]) err.push('Thiếu giải thích VI');
    if (seen[String(r[C('Nội dung kiểm tra')]) + '|' + r[C('Câu hỏi')]] > 1 && !GROUP_TYPES.includes(loai)) err.push('Trùng nội dung với câu khác');

    const row = i + 2;
    if (err.length) {
      b.sh.getRange(row, cTT + 1).setValue('Trả về');
      b.sh.getRange(row, cLoi + 1).setValue('Khác');
      b.sh.getRange(row, cNX + 1).setValue('Tự kiểm tra: ' + err.join('; '));
      bad++;
    } else {
      b.sh.getRange(row, cTT + 1).setValue('Đang QC VN');
      ok++;
    }
  });
  log_('2. Tự kiểm tra', 'Draft', 'OK', ok + ' đạt → Đang QC VN; ' + bad + ' lỗi → Trả về');
  toast_(ok + ' câu đạt, ' + bad + ' câu trả về.');
}

// ───────────────────────── 3. Chuyển trạng thái QC ─────────────────────────

function chuyenTrangThaiQC() {
  const b = table_(SH.BANK);
  const cTT = col_(b, 'Trạng thái'), cVN = col_(b, 'QC VN'), cJP = col_(b, 'QC JP');
  const map = { 'Đạt': null, 'Sửa': 'Trả về', 'Loại': 'Loại' };
  let n = 0;
  b.rows.forEach((r, i) => {
    let next = null;
    if (r[cTT] === 'Đang QC VN' && r[cVN] in map) next = map[r[cVN]] || 'Đang QC JP';
    else if (r[cTT] === 'Đang QC JP' && r[cJP] in map) next = map[r[cJP]] || 'Approved';
    if (next) { b.sh.getRange(i + 2, cTT + 1).setValue(next); n++; }
  });
  log_('3. Chuyển QC', '20_NGAN_HANG', 'OK', n + ' câu đổi trạng thái');
  toast_('Đã chuyển ' + n + ' câu.');
}

// ───────────────────────── 4. Tạo audio ─────────────────────────

function taoAudio() {
  const b = table_(SH.BANK);
  const C = p => col_(b, p);
  const folder = subFolder_('audio');
  const done = {};                                  // mã nhóm → url (3-3 dùng chung)
  const started = Date.now();
  let n = 0;
  b.rows.forEach((r, i) => {
    if (Date.now() - started > 5 * 60 * 1000) return;
    const st = r[C('Trạng thái')];
    if (!['Approved', 'Đang QC JP'].includes(st) || r[C('URL audio')]) return;
    const g = r[C('Mã nhóm')];
    let script = String(r[C('Script audio')]);
    if (g && done[g]) { b.sh.getRange(i + 2, C('URL audio') + 1).setValue(done[g]); return; }
    if (g && !/[FMN][:：]/.test(script)) {         // câu (2) của nhóm: lấy script từ câu (1)
      const first = b.rows.find(x => x[C('Mã nhóm')] === g && /[FMN][:：]/.test(String(x[C('Script audio')])));
      script = first ? String(first[C('Script audio')]) : '';
    }
    if (!/[FMN][:：]/.test(script)) return;
    try {
      const blob = synth_(script).setName((g || r[C('Mã câu')]) + '.mp3');
      const f = folder.createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const url = 'https://drive.google.com/uc?export=download&id=' + f.getId();
      b.sh.getRange(i + 2, C('URL audio') + 1).setValue(url);
      if (g) done[g] = url;
      n++;
    } catch (e) {
      log_('4. Tạo audio', r[C('Mã câu')], 'LỖI', e.message);
    }
  });
  log_('4. Tạo audio', '20_NGAN_HANG', 'OK', n + ' file');
  toast_('Đã tạo ' + n + ' file audio.');
}

function synth_(script) {
  const voice = { F: prop_('TTS_VOICE_F'), M: prop_('TTS_VOICE_M'), N: prop_('TTS_VOICE_N') };
  const parts = [];
  script.split('\n').forEach(line => {
    const m = line.match(/^\s*([FMN])\s*[:：]\s*(.+)$/);
    if (!m) return;
    const name = voice[m[1]];
    const ssml = !/Chirp/i.test(name);             // Chirp3-HD không nhận SSML
    const input = ssml
      ? { ssml: '<speak>' + m[2].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<break time="700ms"/></speak>' }
      : { text: m[2] };
    const res = UrlFetchApp.fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + prop_('GCP_TTS_API_KEY'), {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ input, voice: { languageCode: 'ja-JP', name },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 } }),
    });
    if (res.getResponseCode() !== 200) throw new Error('TTS: ' + res.getContentText().slice(0, 200));
    parts.push(Utilities.base64Decode(JSON.parse(res.getContentText()).audioContent));
  });
  if (!parts.length) throw new Error('Script không có dòng F:/M:/N:');
  return Utilities.newBlob([].concat.apply([], parts), 'audio/mpeg');
}

function subFolder_(name) {
  const root = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID'));
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// ───────────────────────── 5. Xuất LMS ─────────────────────────

function xuatLMS() {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('Xuất file LMS', 'Nhập mã đề (VD: DT-01) hoặc bài luyện (VD: A1-05):', ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return;
  const key = ans.getResponseText().trim();

  const b = table_(SH.BANK);
  const C = p => col_(b, p);
  const byId = {};
  b.rows.forEach(r => { byId[r[C('Mã câu')]] = r; });

  let list;
  const m = key.match(/^(A1|A2-1|A2-2)-(\d{1,2})$/);
  if (m) {
    list = b.rows.filter(r => r[C('Cấp')] === m[1] && Number(r[C('Bài')]) === Number(m[2])
      && r[C('Pool')] === 'Luyện tập' && r[C('Trạng thái')] === 'Approved');
  } else {
    const rap = table_(SH.RAP);
    list = rap.rows.filter(r => r[rap.head['Mã đề']] === key)
      .sort((x, y) => x[rap.head['STT']] - y[rap.head['STT']])
      .map(r => byId[r[rap.head['Mã câu']]]).filter(Boolean);
  }
  if (!list.length) return ui.alert('Không có câu Approved cho "' + key + '".');

  const notReady = list.filter(r => r[C('Trạng thái')] !== 'Approved'
    || (LISTEN_TYPES.includes(String(r[C('Dạng')])) && !r[C('URL audio')]));
  if (notReady.length && ui.alert(notReady.length + ' câu chưa Approved hoặc thiếu audio. Vẫn xuất?',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  // Văn bản chung của nhóm (bài đọc 4-x) lấy từ câu đầu có nội dung
  const groupText = {};
  b.rows.forEach(r => {
    const g = r[C('Mã nhóm')], t = stripTag_(r[C('Nội dung kiểm tra')]);
    if (g && t && !groupText[g]) groupText[g] = t;
  });

  const out = [LMS_HEADERS];
  list.forEach((r, k) => {
    const loai = String(r[C('Dạng')]);
    const lines = [];
    const vi = r[C('Yêu cầu VI')], jp = r[C('Yêu cầu JP')];
    if (vi) lines.push(vi);
    if (jp && jp !== '—' && /^(1-|2-1)/.test(loai)) lines.push(jp);           // QD-01: VI trước, JP sau
    if (r[C('Tình huống VI')]) lines.push(r[C('Tình huống VI')]);
    const nd = stripTag_(r[C('Nội dung kiểm tra')]) || (r[C('Mã nhóm')] ? groupText[r[C('Mã nhóm')]] : '');
    if (nd && !LISTEN_TYPES.includes(loai)) lines.push(nd);
    if (r[C('Câu hỏi')]) lines.push(r[C('Câu hỏi')]);
    const tag = ['JFT', loai, r[C('Cấp')] + '-' + String(r[C('Bài')]).padStart(2, '0'), r[C('Mã câu')]].join('|');
    out.push([
      r[C('URL audio')] || '', lines.join('\n'), r[C('Đáp án')], r[C('Giải thích VI')], r[C('URL hình')] || '',
      r[C('Lựa chọn 1')], r[C('Lựa chọn 2')], r[C('Lựa chọn 3')], r[C('Lựa chọn 4')] || '', k + 1, tag,
    ]);
  });

  const tmp = SpreadsheetApp.create('LMS_' + key + '_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmm'));
  const s = tmp.getSheets()[0].setName('MULTIPLE CHOICE (Advanced)');
  s.getRange(1, 1, out.length, LMS_HEADERS.length).setNumberFormat('@').setValues(out);
  SpreadsheetApp.flush();
  const xlsx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  }).getBlob().setName(tmp.getName() + '.xlsx');
  const file = subFolder_('exports').createFile(xlsx);
  DriveApp.getFileById(tmp.getId()).setTrashed(true);

  log_('5. Xuất LMS', key, 'OK', (out.length - 1) + ' câu → ' + file.getUrl());
  ui.alert('Đã xuất ' + (out.length - 1) + ' câu.\n' + file.getUrl());
}

function stripTag_(s) {
  return String(s || '').split('\n').filter(l => !/^\s*\[.*\]\s*$/.test(l)).join('\n').trim();
}

// ───────────────────────── Dữ liệu nguồn cho prompt ─────────────────────────

const CAP_JP = { 'A1': '入門', 'A2-1': '初級1', 'A2-2': '初級2' };
const baiSo_ = v => Number(String(v).replace(/\D/g, '')) || 0;

/** Trích mục nguồn của đúng cấp/bài (và từ đã học trước đó để làm nhiễu) đưa vào prompt. */
function srcItems_(loai, cap, bai) {
  const ss = SpreadsheetApp.getActive();
  const rows = name => { const s = ss.getSheetByName(name); return s ? s.getDataRange().getValues().slice(1) : []; };
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
    cur = rows('SRC_2-2').filter(x => x[1] === cap && baiSo_(x[2]) === n)
      .map(x => x[3] + ' | ' + x[4] + ' | A: ' + x[5] + ' | B: ' + x[6]);
  } else if (loai === '4-1' || loai === '4-2') {
    cur = rows('SRC_4').filter(x => x[0] === cap && baiSo_(x[1]) === n)
      .map(x => x[2] + ' | Nguồn sách: ' + x[3] + ' | ' + x[4] + ' | ' + x[5] + ' | Gợi ý: ' + x[7]);
  }
  const out = [];
  if (cur.length) out.push('MỤC NGUỒN CỦA BÀI (chỉ ra câu từ các mục này):\n- ' + cur.join('\n- '));
  if (prev.length) out.push('Từ đã học ở các bài trước (được dùng làm phương án nhiễu):\n' + prev.slice(-150).join('、'));
  return out.join('\n');
}

// ───────────────────────── 0. Tạo phiếu từ kế hoạch ─────────────────────────

function taoPhieuTuKeHoach() {
  const ss = SpreadsheetApp.getActive();
  const kh = ss.getSheetByName(SH.KH);
  const plans = kh.getRange(KH_HEADER_ROW + 1, 1, kh.getLastRow() - KH_HEADER_ROW, 13).getValues();
  const mt = ss.getSheetByName(SH.MA_TRAN);
  const head = mt.getRange(TICK.HEADER_ROW, TICK.FIRST_COL, 1, TICK.N_COL).getValues()[0].map(String);
  const grid = mt.getRange(TICK.FIRST, 1, TICK.LAST - TICK.FIRST + 1, TICK.FIRST_COL - 1 + TICK.N_COL).getValues();
  const dang = table_(SH.DANG);
  const yc = table_(SH.YC);
  const H = yc.head;
  const cDot = col_(yc, 'Mã đợt');
  const exist = new Set(yc.rows.map(r => [r[cDot], r[H['Cấp']], baiSo_(r[H['Bài']]), String(r[H['Dạng']])].join('|')));
  const newYC = nextId_(yc, H['Mã YC'], 'YC');
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
        out.push([newYC(), "'" + loai, pool || 'Luyện tập', '', cap, baiSo_(g[1]),
          spec[3] || '', (spec[7] || '') + (LISTEN_TYPES.concat(['4-1', '4-2']).includes(loai) ? ' + 15_NGU_LIEU_BO_SUNG (đã duyệt)' : ''),
          spec[16] || '', donVi, ghiChu || '', nguoi || '', 'ChatGPT (Apps Script)', deadline || '', 'Sẵn sàng sinh']);
        dots.push([ma]);
      });
    });
    if (out.length) {
      yc.sh.getRange(start, 1, out.length, out[0].length).setValues(out);
      yc.sh.getRange(start, cDot + 1, dots.length, 1).setValues(dots);
      start += out.length;
      tong += out.length;
    }
    kh.getRange(KH_HEADER_ROW + 1 + k, 13).setValue('Đã tạo phiếu');
    log_('0. Tạo phiếu', ma, 'OK', out.length + ' phiếu');
  });
  toast_('Đã tạo ' + tong + ' phiếu "Sẵn sàng sinh". Chạy tiếp Menu 1 hoặc bật chạy tự động.');
}

// ───────────────────────── Chạy tự động ─────────────────────────

function batTuDong() {
  tatTuDong(true);
  ScriptApp.newTrigger('chayTuDong').timeBased().everyHours(1).create();
  SpreadsheetApp.getActive().getSheetByName(SH.KH).getRange(KH_CELL.TU_DONG).setValue('Bật');
  log_('⏱ Tự động', 'trigger', 'Bật', 'mỗi giờ: sinh câu + tự kiểm tra');
  toast_('Đã bật: mỗi giờ tự sinh tối đa ' + SpreadsheetApp.getActive().getSheetByName(SH.KH).getRange(KH_CELL.MAX_CAU).getValue() + ' câu rồi tự kiểm tra.');
}

function tatTuDong(silent) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'chayTuDong').forEach(t => ScriptApp.deleteTrigger(t));
  if (silent === true) return;
  SpreadsheetApp.getActive().getSheetByName(SH.KH).getRange(KH_CELL.TU_DONG).setValue('Tắt');
  log_('⏱ Tự động', 'trigger', 'Tắt', '');
  toast_('Đã tắt chạy tự động.');
}

/** Trigger mỗi giờ: hết phiếu "Sẵn sàng sinh" thì chỉ tự kiểm tra, không gọi AI. */
function chayTuDong() {
  sinhCauTuPhieu();
  tuKiemTra();
}
