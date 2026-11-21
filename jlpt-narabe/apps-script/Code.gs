/**
 * API lưu lịch sử luyện 並べ替え（★）vào Google Sheet.
 *
 * Triển khai: xem jlpt-narabe/apps-script/HUONG_DAN.md
 * Script Properties:
 *   GOOGLE_CLIENT_ID  (bắt buộc nếu bật đăng nhập Google)  …apps.googleusercontent.com
 *   TOKEN_SECRET      (tự sinh khi chạy setup())
 *
 * Các tab trong Sheet (tự tạo khi chạy setup()):
 *   NguoiDung   – mỗi người 1 dòng: email, cách đăng nhập, nguồn, đồng ý, số liệu tổng
 *   PhienLuyen  – mỗi phiên 1 dòng
 *   TraLoi      – mỗi câu trả lời 1 dòng (để thống kê câu hay sai)
 *   TienDo      – trạng thái đầy đủ (lịch sử + kho) dạng JSON, để khôi phục trên máy khác
 */

const TAB = {
  USER: 'NguoiDung', SESS: 'PhienLuyen', ANS: 'TraLoi', PROG: 'TienDo',
};
const HEAD = {
  NguoiDung: ['Email', 'Tên', 'Cách đăng nhập', 'Ngày tạo', 'Hoạt động gần nhất', 'Đồng ý điều khoản',
    'utm_source', 'utm_medium', 'utm_campaign', 'Trang vào đầu tiên', 'Số phiên', 'Số câu đã trả lời', 'Số câu đúng', 'Tỉ lệ đúng'],
  PhienLuyen: ['Thời gian', 'Email', 'Cấp độ', 'Nguồn câu', 'Số câu', 'Đúng', 'Tỉ lệ'],
  TraLoi: ['Thời gian', 'Email', 'Cấp độ', 'Mã câu', 'Kỳ thi', 'Câu số', 'Chọn', 'Đáp án', 'Đúng/Sai'],
  TienDo: ['Email', 'Cấp độ', 'Cập nhật', 'JSON'],
};
const TOKEN_DAYS = 180;
const OTP_MINUTES = 10;

/* ───────────── chạy 1 lần sau khi dán code ───────────── */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold').setBackground('#FDE3D3');
      sh.setFrozenRows(1);
    }
  });
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  // gửi thử để cấp quyền gửi mail
  Logger.log('Xong. Hạn mức gửi mail còn lại hôm nay: ' + MailApp.getRemainingDailyQuota());
}

/* ───────────── cổng vào ───────────── */
function doGet() {
  return json({ ok: true, msg: 'API luyện 並べ替え đang chạy' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const fn = ACTIONS[req.action];
    if (!fn) return json({ ok: false, err: 'Sai action' });
    return json(fn(req));
  } catch (err) {
    return json({ ok: false, err: String(err.message || err) });
  }
}

const ACTIONS = {
  /* 1a. Email: gửi mã 6 số */
  sendCode(req) {
    const email = normEmail(req.email);
    const cache = CacheService.getScriptCache();
    if (cache.get('wait_' + email)) return { ok: false, err: 'Vui lòng đợi 60 giây rồi gửi lại mã.' };
    const cnt = +(cache.get('cnt_' + email) || 0);
    if (cnt >= 5) return { ok: false, err: 'Bạn đã yêu cầu quá nhiều mã. Thử lại sau 1 giờ.' };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('otp_' + email, hash(code), OTP_MINUTES * 60);
    cache.put('try_' + email, '0', OTP_MINUTES * 60);
    cache.put('wait_' + email, '1', 60);
    cache.put('cnt_' + email, String(cnt + 1), 3600);
    MailApp.sendEmail({
      to: email,
      subject: `Mã đăng nhập luyện 並べ替え: ${code}`,
      htmlBody: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#2B1D16">
        <p>Mã đăng nhập của bạn:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#C2461F">${code}</p>
        <p>Mã có hiệu lực trong ${OTP_MINUTES} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        <p>Mankai Academy</p></div>`,
      name: 'Mankai Academy',
    });
    return { ok: true };
  },

  /* 1b. Email: xác nhận mã */
  verifyCode(req) {
    const email = normEmail(req.email);
    const cache = CacheService.getScriptCache();
    const saved = cache.get('otp_' + email);
    if (!saved) return { ok: false, err: 'Mã đã hết hạn. Vui lòng gửi lại mã.' };
    const tries = +(cache.get('try_' + email) || 0);
    if (tries >= 5) { cache.remove('otp_' + email); return { ok: false, err: 'Nhập sai quá 5 lần. Vui lòng gửi lại mã.' }; }
    if (hash(String(req.code || '').trim()) !== saved) {
      cache.put('try_' + email, String(tries + 1), OTP_MINUTES * 60);
      return { ok: false, err: 'Mã không đúng.' };
    }
    cache.remove('otp_' + email);
    upsertUser(email, '', 'Email', req);
    return { ok: true, token: makeToken(email), email };
  },

  /* 2. Google: xác minh ID token do nút "Đăng nhập với Google" trả về */
  google(req) {
    const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (!clientId) return { ok: false, err: 'Chưa cấu hình GOOGLE_CLIENT_ID' };
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(req.credential),
      { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, err: 'Đăng nhập Google không hợp lệ' };
    const info = JSON.parse(res.getContentText());
    if (info.aud !== clientId || String(info.email_verified) !== 'true') return { ok: false, err: 'Đăng nhập Google không hợp lệ' };
    const email = normEmail(info.email);
    upsertUser(email, info.name || '', 'Google', req);
    return { ok: true, token: makeToken(email), email, name: info.name || '' };
  },

  /* 3. Lấy tiến độ đã lưu (khi đăng nhập trên máy mới) */
  pull(req) {
    const email = checkToken(req.token);
    const sh = sheet(TAB.PROG), data = sh.getDataRange().getValues();
    const out = {};
    for (let i = 1; i < data.length; i++) if (data[i][0] === email) out[data[i][1]] = JSON.parse(data[i][3] || '{}');
    touchUser(email);
    return { ok: true, progress: out };
  },

  /* 4. Ghi tiến độ (+ phiên, + câu trả lời nếu có) */
  push(req) {
    const email = checkToken(req.token);
    const level = String(req.level || '').slice(0, 4);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const now = new Date();
      if (req.progress) {
        const sh = sheet(TAB.PROG), data = sh.getDataRange().getValues();
        const body = JSON.stringify(req.progress).slice(0, 49000);
        let row = 0;
        for (let i = 1; i < data.length; i++) if (data[i][0] === email && data[i][1] === level) { row = i + 1; break; }
        if (row) sh.getRange(row, 3, 1, 2).setValues([[now, body]]);
        else sh.appendRow([email, level, now, body]);
      }
      if (Array.isArray(req.answers) && req.answers.length) {
        sheet(TAB.ANS).getRange(sheet(TAB.ANS).getLastRow() + 1, 1, req.answers.length, 9).setValues(
          req.answers.slice(0, 200).map(a => [new Date(a.t || now), email, level, a.id, a.exam, a.no, a.pick, a.star, a.ok ? 'Đúng' : 'Sai']));
      }
      if (req.session) {
        const s = req.session;
        sheet(TAB.SESS).appendRow([new Date(s.t || now), email, level, s.src, s.total, s.ok, s.total ? s.ok / s.total : 0]);
      }
      updateUserStats(email, req);
    } finally { lock.releaseLock(); }
    return { ok: true };
  },
};

/* ───────────── người dùng ───────────── */
function upsertUser(email, name, method, req) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheet(TAB.USER), f = sh.getRange('A:A').createTextFinder(email).matchEntireCell(true).findNext();
    const now = new Date(), u = req.utm || {};
    if (f) {
      const r = f.getRow();
      if (name && !sh.getRange(r, 2).getValue()) sh.getRange(r, 2).setValue(name);
      sh.getRange(r, 5).setValue(now);
      if (req.consent) sh.getRange(r, 6).setValue(now);
    } else {
      sh.appendRow([email, name, method, now, now, req.consent ? now : '', u.utm_source || '', u.utm_medium || '', u.utm_campaign || '',
        String(u.landing || '').slice(0, 300), 0, 0, 0, 0]);
    }
  } finally { lock.releaseLock(); }
}
function touchUser(email) {
  const f = sheet(TAB.USER).getRange('A:A').createTextFinder(email).matchEntireCell(true).findNext();
  if (f) sheet(TAB.USER).getRange(f.getRow(), 5).setValue(new Date());
}
function updateUserStats(email, req) {
  const sh = sheet(TAB.USER), f = sh.getRange('A:A').createTextFinder(email).matchEntireCell(true).findNext();
  if (!f) return;
  const r = f.getRow(), v = sh.getRange(r, 11, 1, 3).getValues()[0];
  const ans = Array.isArray(req.answers) ? req.answers : [];
  const n = (+v[1] || 0) + ans.length, ok = (+v[2] || 0) + ans.filter(a => a.ok).length;
  sh.getRange(r, 5).setValue(new Date());
  sh.getRange(r, 11, 1, 4).setValues([[(+v[0] || 0) + (req.session ? 1 : 0), n, ok, n ? ok / n : 0]]);
}

/* ───────────── tiện ích ───────────── */
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function normEmail(e) {
  e = String(e || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 120) throw new Error('Email không hợp lệ');
  return e;
}
function hash(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + secret()));
}
function secret() { return PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET'); }
function sign(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret())); }
function makeToken(email) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify({ e: email, x: Date.now() + TOKEN_DAYS * 864e5 }));
  return body + '.' + sign(body);
}
function checkToken(t) {
  const [body, sig] = String(t || '').split('.');
  if (!body || sign(body) !== sig) throw new Error('AUTH');
  const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
  if (p.x < Date.now()) throw new Error('AUTH');
  return p.e;
}
