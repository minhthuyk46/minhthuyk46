/**
 * TOKUTEI – Sinh Flashcard + Quiz từ vựng theo bài → file .xlsx form import LMS
 *
 * Nguồn: sheet "Từ vựng" (A: STT | B: Từ vựng | C: Hiragana | D: Nghĩa TV | E: Bài học)
 * Đầu ra (mỗi bài 2 file, lưu trong 1 folder Drive):
 *   - Flashcard_tu_vung_Bai_N.xlsx  (sheet "Flashcard mẫu")
 *   - Quiz_tu_vung_Bai_N.xlsx       (sheet "MULTIPLE CHOICE (Advanced)")
 * Log link file ở sheet "Xuất file".
 */

var CFG = {
  SOURCE_SHEET: 'Từ vựng',
  LOG_SHEET: 'Xuất file',
  FOLDER_NAME: 'TOKUTEI – Flashcard & Quiz từ vựng',
  QUIZ_COUNT: 30,
  OPTION_COUNT: 3,
  FC_SHEET: 'Flashcard mẫu',
  FC_HEADER: ['Cách đọc', 'Loại thẻ (từ vựng/ngữ pháp/hán tự)', 'Mặt sau', 'Mặt trước', 'STT'],
  QZ_SHEET: 'MULTIPLE CHOICE (Advanced)',
  QZ_HEADER: ['Audio Url', 'Content', 'Correct Answer', 'Explanation', 'Image Url',
              'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'STT', 'Tag']
};

/* ===================== MENU ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎴 Flashcard & Quiz')
    .addItem('▶ Xuất TẤT CẢ các bài', 'exportAllLessons')
    .addItem('▶ Xuất 1 bài…', 'exportOneLessonPrompt')
    .addToUi();
}

function exportAllLessons() {
  var lessons = groupByLesson_(readVocab_());
  var names = Object.keys(lessons).sort(lessonSort_);
  var t0 = Date.now(), done = [];
  for (var i = 0; i < names.length; i++) {
    if (Date.now() - t0 > 4.5 * 60 * 1000) {
      SpreadsheetApp.getUi().alert('Sắp hết 6 phút. Đã xuất: ' + done.join(', ') +
        '\nBấm "Xuất 1 bài…" cho các bài còn lại.');
      return;
    }
    exportLesson_(names[i], lessons);
    done.push(names[i]);
  }
  SpreadsheetApp.getUi().alert('Xong ' + done.length + ' bài. Xem link ở sheet "' + CFG.LOG_SHEET + '".');
}

function exportOneLessonPrompt() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Nhập tên bài (VD: Bài 3 hoặc 3)');
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = String(r.getResponseText()).trim();
  if (/^\d+$/.test(name)) name = 'Bài ' + name;
  var lessons = groupByLesson_(readVocab_());
  if (!lessons[name]) { ui.alert('Không tìm thấy "' + name + '"'); return; }
  exportLesson_(name, lessons);
  ui.alert('Đã xuất ' + name + '. Xem link ở sheet "' + CFG.LOG_SHEET + '".');
}

/* ===================== ĐỌC DỮ LIỆU ===================== */

function readVocab_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOURCE_SHEET);
  var v = sh.getDataRange().getDisplayValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var w = String(v[i][1]).trim(), m = String(v[i][3]).trim(), l = String(v[i][4]).trim();
    if (!w || !m || !l) continue;
    out.push({ stt: v[i][0], word: w, reading: String(v[i][2]).trim(), meaning: m, lesson: l });
  }
  return out;
}

/* ===================== LOGIC THUẦN (test được bằng Node) ===================== */

function groupByLesson_(rows) {
  var g = {};
  rows.forEach(function (r) {
    var list = g[r.lesson] = g[r.lesson] || [];
    // bỏ dòng trùng y hệt (cùng từ + cùng nghĩa) trong cùng 1 bài
    if (!list.some(function (x) { return x.word === r.word && x.meaning === r.meaning; })) list.push(r);
  });
  return g;
}

function lessonSort_(a, b) {
  return (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0);
}

/** Flashcard: mặt trước = từ (dòng 1) + furigana (dòng 2); mặt sau = nghĩa. */
function buildFlashcardRows(words) {
  return words.map(function (w, i) {
    var front = w.reading ? w.word + '\n' + w.reading : w.word;
    return [w.reading, 'từ vựng', w.meaning, front, String(i + 1)];
  });
}

/**
 * Quiz 30 câu, 3 đáp án.
 * - Câu chẵn: JP → chọn nghĩa VN; câu lẻ: VN → chọn từ JP.
 * - Mỗi từ của bài xuất hiện ≥ 1 lần (ở câu hỏi hoặc đáp án): ưu tiên từ chưa xuất hiện làm đáp án nhiễu.
 * - Không lấy đáp án nhiễu trùng nghĩa / trùng từ với đáp án đúng.
 * - Bài có < 3 từ: mượn từ bài khác (allWords) làm đáp án nhiễu.
 */
function buildQuizRows(words, allWords, lessonName) {
  var rnd = rng_(hash_(lessonName));
  var norm = function (s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); };
  var key = function (w) { return w.word + '|' + w.meaning; };
  var seen = {};
  var order = shuffle_(words.slice(), rnd);

  // Đích câu hỏi: lần lượt từng từ, lặp vòng nếu bài < 30 từ
  var targets = [];
  while (targets.length < CFG.QUIZ_COUNT) {
    var batch = targets.length === 0 ? order : shuffle_(words.slice(), rnd);
    for (var i = 0; i < batch.length && targets.length < CFG.QUIZ_COUNT; i++) targets.push(batch[i]);
  }
  var nQ = Math.min(CFG.QUIZ_COUNT, words.length);
  for (var q = 0; q < nQ; q++) seen[key(targets[q])] = true;

  var rows = [];
  targets.forEach(function (t, idx) {
    var jpToVn = idx % 2 === 0;
    var ok = function (c) {
      return c.word !== t.word && norm(c.meaning) !== norm(t.meaning);
    };
    var inLesson = words.filter(ok);
    var pool = inLesson.length >= CFG.OPTION_COUNT - 1 ? inLesson
      : inLesson.concat(shuffle_(allWords.filter(function (c) {
          return ok(c) && inLesson.indexOf(c) < 0;
        }), rnd));
    var unseen = shuffle_(pool.filter(function (c) { return !seen[key(c)]; }), rnd);
    var rest = shuffle_(pool.filter(function (c) { return seen[key(c)]; }), rnd);
    var picks = [];
    unseen.concat(rest).forEach(function (c) {
      if (picks.length >= CFG.OPTION_COUNT - 1) return;
      var dup = picks.some(function (p) { return p.word === c.word || norm(p.meaning) === norm(c.meaning); });
      if (!dup) picks.push(c);
    });
    picks.forEach(function (p) { seen[key(p)] = true; });
    seen[key(t)] = true;

    var opts = shuffle_([t].concat(picks), rnd);
    var correct = opts.indexOf(t) + 1;
    var content = jpToVn
      ? 'Chọn nghĩa đúng của từ: ' + t.word
      : 'Chọn từ tiếng Nhật có nghĩa là: ' + t.meaning;
    var optText = opts.map(function (o) { return jpToVn ? o.meaning : o.word; });
    var expl = t.word + (t.reading ? '（' + t.reading + '）' : '') + ': ' + t.meaning;
    rows.push(['', content, correct, expl, '', optText[0], optText[1], optText[2], '', '', idx + 1, lessonName]);
  });

  var missing = words.filter(function (w) { return !seen[key(w)]; });
  if (missing.length) throw new Error(lessonName + ': chưa phủ ' + missing.map(function (m) { return m.word; }).join(', '));
  return rows;
}

function hash_(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng_(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle_(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

/* ===================== XUẤT FILE ===================== */

function exportLesson_(name, lessons) {
  var words = lessons[name];
  var all = [];
  Object.keys(lessons).forEach(function (k) { all = all.concat(lessons[k]); });
  var slug = name.replace('Bài', 'Bai').replace(/\s+/g, '_');
  var folder = getFolder_();

  var fc = writeXlsx_(folder, 'Flashcard_tu_vung_' + slug, CFG.FC_SHEET, CFG.FC_HEADER, buildFlashcardRows(words));
  var qz = writeXlsx_(folder, 'Quiz_tu_vung_' + slug, CFG.QZ_SHEET, CFG.QZ_HEADER, buildQuizRows(words, all, name));
  log_([name, words.length, fc.getUrl(), qz.getUrl(), new Date()]);
}

function writeXlsx_(folder, fileName, sheetName, header, rows) {
  var tmp = SpreadsheetApp.create(fileName + '_tmp');
  var sh = tmp.getSheets()[0].setName(sheetName);
  var data = [header].concat(rows);
  sh.getRange(1, 1, data.length, header.length).setNumberFormat('@').setValues(data);
  if (sheetName === CFG.QZ_SHEET) sh.getRange(2, 3, rows.length, 1).setNumberFormat('0'); // Correct Answer
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  SpreadsheetApp.flush();

  var url = 'https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx';
  var blob = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })
    .getBlob().setName(fileName + '.xlsx');
  var old = folder.getFilesByName(fileName + '.xlsx');
  while (old.hasNext()) old.next().setTrashed(true);       // ghi đè bản cũ
  var file = folder.createFile(blob);
  DriveApp.getFileById(tmp.getId()).setTrashed(true);
  return file;
}

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('OUTPUT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder(CFG.FOLDER_NAME);
  props.setProperty('OUTPUT_FOLDER_ID', f.getId());
  return f;
}

function log_(row) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.LOG_SHEET) || ss.insertSheet(CFG.LOG_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(['Bài', 'Số từ', 'File Flashcard', 'File Quiz', 'Thời gian xuất']);
  sh.appendRow(row);
}

if (typeof module !== 'undefined') module.exports = { groupByLesson_: groupByLesson_, lessonSort_: lessonSort_, buildFlashcardRows: buildFlashcardRows, buildQuizRows: buildQuizRows };
