// Giả lập tối thiểu SpreadsheetApp / DriveApp / UrlFetchApp ... để chạy Code.gs trong Node.
const fs = require('fs'), vm = require('vm');

function colToNum(s) { return s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0); }

class Sheet {
  constructor(name, data, ss) { this.name = name; this.d = data.map(r => r.slice()); this.ss = ss; this.maxRows = Math.max(1000, this.d.length); this.maxCols = Math.max(30, ...this.d.map(r => r.length)); this.validations = {}; }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  cell(r, c) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); return row; }
  getRange(a, b, nr, nc) {
    if (typeof a === 'string') { const m = a.match(/^([A-Z]+)(\d+)$/); return new Range(this, +m[2], colToNum(m[1]), 1, 1); }
    return new Range(this, a, b, nr || 1, nc || 1);
  }
  getLastRow() { for (let i = this.d.length - 1; i >= 0; i--) if (this.d[i].some(v => v !== '' && v !== undefined)) return i + 1; return 0; }
  getLastColumn() { return Math.max(0, ...this.d.map(r => { for (let i = r.length - 1; i >= 0; i--) if (r[i] !== '' && r[i] !== undefined) return i + 1; return 0; })); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(c, n) { this.maxCols += n; }
  setFrozenRows() { return this; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(v) { const r = this.getLastRow() + 1; v.forEach((x, i) => { this.cell(r, i + 1)[i] = x; }); }
}
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('setValues size mismatch ' + this.sh.name);
    v.forEach((row, i) => row.forEach((x, j) => { const R = this.sh.cell(this.r + i, this.c + j); R[this.c + j - 1] = typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x; }));
    return this;
  }
  setValue(x) { return this.setValues([[x]]); }
  setFormula(f) { return this.setValues([['=' + f.replace(/^=/, '')]]); }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setDataValidation(v) { this.sh.validations[this.c] = v; return this; }
}
class SS {
  constructor(data, id) { this.id = id || 'SS1'; this.sheets = Object.entries(data).map(([n, d]) => new Sheet(n, d, this)); this.toasts = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n, [[]], this); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  getId() { return this.id; }
  toast(m) { this.toasts.push(m); }
}

function makeEnv(data, opts = {}) {
  const ss = new SS(data);
  const created = [];
  const files = [];                                   // {name, folder, id, blob}
  let fid = 0;
  const folder = name => ({
    name, getFoldersByName: n => { const f = folder(n); return { hasNext: () => true, next: () => f }; },
    createFolder: n => folder(n), getUrl: () => 'https://drive/' + name,
    getFiles: () => { const l = files.filter(f => f.folder === name); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
    createFile: blob => { const f = mkFile(blob.name, name, blob); return f; },
  });
  const mkFile = (name, fold, blob) => { const f = { name, folder: fold, id: 'F' + (++fid), blob, getName: () => name, getId: () => f.id, setSharing: () => f, getUrl: () => 'https://drive/file/' + f.id, setTrashed: () => f }; files.push(f); return f; };
  const blob = (bytes, type) => ({ bytes, type, name: '', setName(n) { this.name = n; return this; }, getBytes() { return this.bytes; } });
  const ctx = {
    console,
    SpreadsheetApp: {
      getActive: () => ss, flush: () => {},
      create: n => { const s = new SS({ Sheet1: [[]] }, 'NEW' + created.length); s.sheets[0].name = 'Sheet1'; created.push(s); s.name = n; s.getName = () => n; return s; },
      getUi: () => ({ alert: m => { ctx.__alerts.push(m); }, prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => opts.promptAnswer || '' }), Button: { OK: 'OK', YES: 'YES' }, ButtonSet: {} }),
      newDataValidation: () => { const b = { requireValueInList: (l) => { b.list = l; return b; }, setAllowInvalid: () => b, build: () => ({ list: b.list }) }; return b; },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (opts.props || {})[k] || null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => 'tester@sim' }) },
    Utilities: {
      formatDate: () => '2026-10-09 10:00',
      base64Decode: s => Array.from(Buffer.from(s, 'base64')).map(b => (b > 127 ? b - 256 : b)),
      newBlob: (bytes, type) => blob(bytes, type),
    },
    DriveApp: {
      getFolderById: () => folder('ROOT'), getFileById: id => files.find(f => f.id === id) || { setTrashed: () => {} },
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
    },
    UrlFetchApp: {
      fetch: (url, o) => {
        ctx.__fetches.push({ url, o });
        if (/generativelanguage/.test(url)) {
          const pcm = Buffer.alloc(4800, 1).toString('base64');
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: pcm } }] } }] }) };
        }
        return { getBlob: () => blob([1, 2, 3], 'xlsx') };
      },
    },
    ScriptApp: { getOAuthToken: () => 'tok', getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => { const t = { timeBased: () => t, everyMinutes: () => t, forSpreadsheet: () => t, onEdit: () => t, create: () => t }; return t; } },
    __alerts: [], __fetches: [], __files: files, __created: created, __mkFile: mkFile,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../../apps-script/Code.gs', 'utf8') + '\n;this.__api = {' +
    'caiDat, taoPhieuTuKeHoach, chayTuDong, xuLyKhiSua, taoAudio, xuatLMS_, ganHinh_, table_, col_ };', ctx);
  ctx.ss = ss;
  ctx.edit = (sheetName, row, col1, value) => {           // giả lập người/Agent sửa ô rồi trigger onEdit
    const sh = ss.getSheetByName(sheetName);
    sh.getRange(row, col1).setValue(value);
    ctx.__api.xuLyKhiSua({ range: { getSheet: () => sh, getRow: () => row, getColumn: () => col1 } });
  };
  return ctx;
}
module.exports = { makeEnv };
