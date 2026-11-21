/* Đăng nhập (Google / Email OTP) + đồng bộ tiến độ lên Google Sheet qua Apps Script.
   Không đăng nhập thì trang vẫn chạy bình thường, chỉ lưu trên máy. */
(() => {
const CFG = window.NARABE_CONFIG || {};
const ON = !!CFG.apiUrl;
const LEVELS = ['N3', 'N2', 'N1'];
const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { return null } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* UTM + trang vào đầu tiên (chỉ ghi lần đầu) */
(() => {
  const p = new URLSearchParams(location.search), u = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(k => { if (p.get(k)) u[k] = p.get(k).slice(0, 100) });
  if (!ls('nb_utm')) ls('nb_utm', { ...u, landing: location.href.split('#')[0] });
})();

let auth = ls('nb_auth');               // {token,email,name}
let onMerged = () => {};
const answerQ = {};                     // level → [answers] chờ gửi
let saveTimer = {};

async function api(body) {
  const r = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok && j.err === 'AUTH') { logout(true); throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.') }
  if (!j.ok) throw new Error(j.err || 'Lỗi máy chủ');
  return j;
}

/* ---------- hàng đợi gửi (giữ lại nếu mất mạng) ---------- */
let flushing = false;
function enqueue(payload) { const q = ls('nb_pending') || []; q.push(payload); ls('nb_pending', q.slice(-50)); flush() }
async function flush() {
  if (!auth || flushing) return; flushing = true; setStatus('sync');
  try {
    let q = ls('nb_pending') || [];
    while (q.length) { await api({ ...q[0], action: 'push', token: auth.token }); q.shift(); ls('nb_pending', q) }
    setStatus('ok');
  } catch (e) { setStatus('err', e.message) } finally { flushing = false }
}
window.addEventListener('online', flush);

/* ---------- gộp tiến độ máy này + máy chủ ---------- */
function merge(a, b) {
  a = a || { hist: {}, kho: {}, sessions: [] }; b = b || { hist: {}, kho: {}, sessions: [] };
  const hist = { ...a.hist };
  for (const id in b.hist || {}) if (!hist[id] || (b.hist[id].n || 0) > (hist[id].n || 0)) hist[id] = b.hist[id];
  const kho = { ...(b.kho || {}), ...(a.kho || {}) };
  const seen = new Set(), sessions = [];
  [...(a.sessions || []), ...(b.sessions || [])].sort((x, y) => x.t - y.t).forEach(s => { if (!seen.has(s.t)) { seen.add(s.t); sessions.push(s) } });
  return { hist, kho, sessions };
}
async function pullAndMerge() {
  setStatus('sync');
  const { progress } = await api({ action: 'pull', token: auth.token });
  LEVELS.forEach(l => {
    const local = ls('nb_db_' + l), remote = progress[l];
    if (!local && !remote) return;
    const m = merge(local, remote);
    ls('nb_db_' + l, m);
    enqueue({ level: l, progress: m });
  });
  setStatus('ok'); onMerged();
}

/* ---------- giao diện ---------- */
const css = `
.acct{display:flex;align-items:center;gap:8px;font-size:14px}
.acct .who{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.acct .dot{width:9px;height:9px;border-radius:50%;background:var(--ok);flex:none}
.acct .dot.sync{background:var(--sun)}.acct .dot.err{background:var(--bad)}
.cta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--peach);border-radius:24px;padding:12px 16px;margin-bottom:18px;font-size:14px}
.cta span{flex:1;min-width:200px}
.modal-bg{position:fixed;inset:0;background:rgba(43,29,22,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:100}
.modal{width:100%;max-width:420px;background:var(--card);color:var(--ink);border:2px solid var(--edge);border-radius:28px;box-shadow:6px 6px 0 var(--shadow);padding:24px;position:relative}
.modal h2{font-family:"Unbounded",sans-serif;font-size:22px;margin:0 0 6px}
.modal p{margin:0 0 14px;color:var(--muted);font-size:14px}
.modal .x{position:absolute;top:12px;right:14px;border:0;background:none;font-size:22px;cursor:pointer;color:var(--ink)}
.modal input[type=email],.modal input[type=text]{width:100%;font:inherit;padding:10px 16px;border:2px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);margin-bottom:10px}
.modal input:focus{border-color:var(--edge);outline:none}
.modal .full{width:100%}
.modal .or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:16px 0}
.modal .or::before,.modal .or::after{content:"";flex:1;border-top:1.5px solid var(--line)}
.modal .consent{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--muted);margin:4px 0 16px;cursor:pointer}
.modal .consent input{margin-top:3px;width:17px;height:17px;accent-color:var(--orange);flex:none}
.modal .msg{font-size:13px;min-height:20px;margin-top:8px}.modal .msg.err{color:var(--bad)}
#gbtn{display:flex;justify-content:center;min-height:44px}
#gbtn.off{opacity:.4;pointer-events:none;filter:grayscale(1)}
`;
if (ON) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st) }

let statusState = 'ok', statusMsg = '';
function setStatus(s, m = '') { statusState = s; statusMsg = m; renderAcct() }
function renderAcct() {
  const el = document.getElementById('acct'); if (!el) return;
  if (!ON) { el.innerHTML = ''; return }
  if (!auth) { el.innerHTML = `<button class="btn" id="acct-login">Đăng nhập</button>`; el.querySelector('button').onclick = open; return }
  const t = { ok: 'Đã đồng bộ', sync: 'Đang đồng bộ…', err: 'Chưa đồng bộ: ' + statusMsg }[statusState];
  el.innerHTML = `<span class="acct" title="${esc(t)}"><span class="dot ${statusState}"></span><span class="who">${esc(auth.name || auth.email)}</span>
    <button class="btn sm" id="acct-out">Đăng xuất</button></span>`;
  el.querySelector('#acct-out').onclick = () => { if (confirm('Đăng xuất? Tiến độ vẫn còn trên máy này và trên tài khoản của bạn.')) logout() };
}
function logout(silent) { auth = null; ls('nb_auth', null); ls('nb_pending', null); renderAcct(); if (!silent) onMerged() }

function cta(el, text) {
  if (!el) return;
  if (!ON || auth) { el.innerHTML = ''; return }
  el.innerHTML = `<div class="cta"><span>🔒 ${esc(text)}</span><button class="btn primary sm">Đăng nhập</button></div>`;
  el.querySelector('button').onclick = open;
}

function loadGIS() {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.id) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Không tải được nút Google')); document.head.appendChild(s);
  });
}

function open() {
  const priv = CFG.privacyUrl ? ` (<a href="${esc(CFG.privacyUrl)}" target="_blank" rel="noopener">chính sách dữ liệu</a>)` : '';
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="lg-t">
    <button class="x" aria-label="Đóng">×</button>
    <h2 id="lg-t">Lưu tiến độ</h2>
    <p>Đăng nhập để lưu lịch sử luyện, tỉ lệ đúng và kho câu cần luyện lại trên mọi thiết bị. Tiến độ trên máy này sẽ được giữ lại.</p>
    <label class="consent"><input type="checkbox" id="lg-ok"> Tôi đồng ý để Mankai Academy lưu email và kết quả luyện tập nhằm lưu tiến độ, gửi tài liệu học và tư vấn khoá học${priv}.</label>
    ${CFG.googleClientId ? `<div id="gbtn" class="off"></div><div class="or">hoặc dùng email</div>` : ''}
    <div id="lg-step1"><input type="email" id="lg-email" placeholder="Email của bạn" autocomplete="email"><button class="btn primary full" id="lg-send">Gửi mã đăng nhập</button></div>
    <div id="lg-step2" hidden><p style="margin-bottom:8px">Mã 6 số đã gửi tới <b id="lg-to"></b>. Kiểm tra cả mục Spam/Quảng cáo.</p>
      <input type="text" id="lg-code" inputmode="numeric" maxlength="6" placeholder="Nhập mã 6 số" autocomplete="one-time-code">
      <button class="btn primary full" id="lg-verify">Xác nhận</button>
      <button class="btn sm" id="lg-back" style="margin-top:10px">← Đổi email</button></div>
    <div class="msg" id="lg-msg" role="status"></div></div>`;
  document.body.appendChild(bg);
  const $m = s => bg.querySelector(s), msg = (t, err) => { $m('#lg-msg').textContent = t; $m('#lg-msg').className = 'msg' + (err ? ' err' : '') };
  const close = () => bg.remove();
  $m('.x').onclick = close; bg.onclick = e => { if (e.target === bg) close() };
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k) } });
  const needConsent = () => { if (!$m('#lg-ok').checked) { msg('Vui lòng tick đồng ý trước khi đăng nhập.', true); return false } return true };
  const base = () => ({ consent: true, utm: ls('nb_utm') || {} });
  const done = async j => {
    auth = { token: j.token, email: j.email, name: j.name || '' }; ls('nb_auth', auth);
    msg('Đăng nhập thành công. Đang đồng bộ…'); renderAcct();
    try { await pullAndMerge() } catch (e) { setStatus('err', e.message) }
    close();
  };

  if (CFG.googleClientId) {
    $m('#lg-ok').addEventListener('change', () => $m('#gbtn').classList.toggle('off', !$m('#lg-ok').checked));
    loadGIS().then(() => {
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        callback: async r => {
          if (!needConsent()) return;
          msg('Đang xác minh…');
          try { await done(await api({ action: 'google', credential: r.credential, ...base() })) } catch (e) { msg(e.message, true) }
        },
      });
      google.accounts.id.renderButton($m('#gbtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi', width: 300 });
    }).catch(e => { $m('#gbtn').textContent = e.message });
  }

  let email = '';
  $m('#lg-send').onclick = async () => {
    if (!needConsent()) return;
    email = $m('#lg-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('Email chưa đúng định dạng.', true);
    $m('#lg-send').disabled = true; msg('Đang gửi mã…');
    try { await api({ action: 'sendCode', email }); $m('#lg-to').textContent = email; $m('#lg-step1').hidden = true; $m('#lg-step2').hidden = false; msg(''); $m('#lg-code').focus() }
    catch (e) { msg(e.message, true) } finally { $m('#lg-send').disabled = false }
  };
  $m('#lg-email').onkeydown = e => { if (e.key === 'Enter') $m('#lg-send').click() };
  $m('#lg-verify').onclick = async () => {
    if (!needConsent()) return;
    $m('#lg-verify').disabled = true; msg('Đang kiểm tra…');
    try { await done(await api({ action: 'verifyCode', email, code: $m('#lg-code').value, ...base() })) }
    catch (e) { msg(e.message, true) } finally { $m('#lg-verify').disabled = false }
  };
  $m('#lg-code').onkeydown = e => { if (e.key === 'Enter') $m('#lg-verify').click() };
  $m('#lg-back').onclick = () => { $m('#lg-step1').hidden = false; $m('#lg-step2').hidden = true; msg('') };
  setTimeout(() => $m('#lg-ok').focus(), 50);
}

/* ---------- các móc để trang chính gọi ---------- */
window.Sync = {
  enabled: ON,
  get user() { return auth },
  init(cb) { onMerged = cb || onMerged; renderAcct(); if (ON && auth) pullAndMerge().catch(e => setStatus('err', e.message)) },
  cta, open,
  save(level, db) {   // lưu tiến độ (gom lại 3 giây rồi gửi 1 lần)
    if (!ON || !auth) return;
    clearTimeout(saveTimer[level]);
    saveTimer[level] = setTimeout(() => enqueue({ level, progress: db }), 3000);
  },
  answer(level, q, pick, ok) {
    if (!ON || !auth) return;
    (answerQ[level] = answerQ[level] || []).push({ t: Date.now(), id: q.id, exam: q.exam, no: q.no, pick, star: q.star, ok });
  },
  session(level, s, db) {
    if (!ON || !auth) return;
    clearTimeout(saveTimer[level]);
    enqueue({ level, session: s, answers: answerQ[level] || [], progress: db }); answerQ[level] = [];
  },
};
})();
