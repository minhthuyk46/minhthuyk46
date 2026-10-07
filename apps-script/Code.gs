/**
 * JFT-Basic Exam Generator — phạm vi giáo trình いろどり (Irodori)
 * Google Sheets + Apps Script + Claude API + Google Cloud Text-to-Speech
 *
 * Script Properties cần khai báo (Project Settings → Script Properties):
 *   CLAUDE_API_KEY   : API key Anthropic
 *   GCP_TTS_API_KEY  : API key Google Cloud (đã bật Text-to-Speech API)
 *   DRIVE_FOLDER_ID  : ID thư mục Drive lưu audio / hình / đề
 */

const SHEETS = {
  CONFIG: 'CONFIG',
  SYLLABUS: 'SYLLABUS_IRODORI',
  BLUEPRINT: 'BLUEPRINT',
  BANK: 'QUESTION_BANK',
  LOG: 'EXAM_LOG',
};

const BANK_HEADERS = [
  'ID', 'Section', 'Type', 'Book', 'Lesson', 'Stem', 'Script',
  'OptionA', 'OptionB', 'OptionC', 'OptionD', 'Answer',
  'Explanation_VI', 'ImagePrompt', 'ImageURL', 'AudioURL', 'Status', 'CreatedAt',
];

/* ============================== MENU ============================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎌 JFT Generator')
    .addItem('0. Khởi tạo cấu trúc sheet', 'setupSheets')
    .addSeparator()
    .addItem('1. Sinh câu hỏi (dòng BLUEPRINT có tick)', 'generateQuestions')
    .addItem('2. Tạo audio cho câu Nghe hiểu', 'generateAudio')
    .addItem('3. Tạo hình minh hoạ (SVG)', 'generateImages')
    .addSeparator()
    .addItem('4. Xuất file import LMS (.xlsx)', 'exportLmsXlsx')
    .addToUi();
}

/* ============================== SETUP ============================== */

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, headers, rows) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
      if (rows && rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
      sh.setFrozenRows(1);
    }
    return sh;
  };

  make(SHEETS.CONFIG, ['Key', 'Value', 'Ghi chú'], [
    ['CLAUDE_MODEL', 'claude-sonnet-5-5', 'Model sinh câu hỏi'],
    ['BOOK_SCOPE', '入門,初級1', 'Các quyển trong phạm vi: 入門 / 初級1 / 初級2'],
    ['LESSON_FROM', 1, 'Bài bắt đầu'],
    ['LESSON_TO', 18, 'Bài kết thúc'],
    ['TTS_VOICE_F', 'ja-JP-Neural2-B', 'Giọng nữ (có thể đổi ja-JP-Chirp3-HD-Aoede)'],
    ['TTS_VOICE_M', 'ja-JP-Neural2-C', 'Giọng nam (có thể đổi ja-JP-Chirp3-HD-Charon)'],
    ['TTS_RATE', 0.95, 'Tốc độ đọc (JFT thực tế ~0.9–1.0)'],
    ['EXAM_TITLE', 'JFT_Thi_thu', 'Tiền tố tên file import LMS'],
  ]);

  make(SHEETS.SYLLABUS, ['Book', 'Lesson', 'Topic', 'Can-do', 'Vocab', 'Kanji', 'Grammar'], []);

  const bp = make(SHEETS.BLUEPRINT,
    ['Run?', 'Section', 'Type', 'Mô tả dạng bài', 'Số câu sinh/lần', 'Số câu/đề', 'Cần ảnh?', 'Cần audio?'],
    BLUEPRINT_DEFAULT);
  bp.getRange(2, 1, BLUEPRINT_DEFAULT.length, 1).insertCheckboxes();

  make(SHEETS.BANK, BANK_HEADERS, []);
  make(SHEETS.LOG, ['Thời gian', 'Tên đề', 'File import LMS', 'Ghi chú', 'Số câu', 'Danh sách ID'], []);
  SpreadsheetApp.getUi().alert('✅ Đã tạo cấu trúc. Hãy nhập SYLLABUS_IRODORI trước khi sinh câu hỏi.');
}

/* JFT-Basic: 4 phần thi. Tên dạng bài đối chiếu với mẫu đề chính thức của JF trước khi dùng. */
const BLUEPRINT_DEFAULT = [
  [false, '文字と語彙', '語の意味',   'Nhìn tranh/ngữ cảnh, chọn từ đúng nghĩa', 5, 4, 'Y', 'N'],
  [false, '文字と語彙', '語の使い方', 'Chọn từ phù hợp điền vào câu',           5, 4, 'N', 'N'],
  [false, '文字と語彙', '漢字の読み', 'Chọn cách đọc của kanji gạch chân',       5, 3, 'N', 'N'],
  [false, '文字と語彙', '漢字の表記', 'Chọn kanji đúng cho từ viết hiragana',     5, 3, 'N', 'N'],
  [false, '会話と表現', '表現',       'Chọn câu nói phù hợp với tình huống',       5, 4, 'Y', 'N'],
  [false, '会話と表現', '文法',       'Chọn ngữ pháp/trợ từ điền vào hội thoại',   5, 8, 'N', 'N'],
  [false, '聴解',       '会話の聴解', 'Nghe hội thoại ngắn, chọn tranh/đáp án',   5, 5, 'Y', 'Y'],
  [false, '聴解',       'アナウンス', 'Nghe thông báo nơi công cộng',              5, 3, 'N', 'Y'],
  [false, '聴解',       '指示の聴解', 'Nghe chỉ thị/hướng dẫn, chọn hành động',    5, 4, 'Y', 'Y'],
  [false, '読解',       '掲示の読解', 'Đọc biển báo, poster, tin nhắn ngắn',      5, 5, 'Y', 'N'],
  [false, '読解',       '文章の読解', 'Đọc email/bài viết ngắn ~200–400 字',       3, 4, 'N', 'N'],
];

/* ============================== HELPERS ============================== */

function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Thiếu Script Property: ' + k);
  return v;
}

function config_() {
  const rows = SpreadsheetApp.getActive().getSheetByName(SHEETS.CONFIG).getDataRange().getValues();
  const c = {};
  rows.slice(1).forEach(r => c[r[0]] = r[1]);
  return c;
}

function sheetObjects_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const [head, ...rows] = sh.getDataRange().getValues();
  return rows.map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => o[h] = r[j]);
    return o;
  });
}

function setCell_(sheetName, row, header, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const col = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf(header) + 1;
  sh.getRange(row, col).setValue(value);
}

function folder_(sub) {
  const root = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID'));
  const it = root.getFoldersByName(sub);
  return it.hasNext() ? it.next() : root.createFolder(sub);
}

function callClaude_(system, user, maxTokens) {
  const cfg = config_();
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': prop_('CLAUDE_API_KEY'), 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: cfg.CLAUDE_MODEL,
      max_tokens: maxTokens || 8000,
      system: system,
      messages: [{ role: 'user', content: user }],
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Claude API: ' + res.getContentText());
  return JSON.parse(res.getContentText()).content.map(b => b.text || '').join('');
}

function parseJson_(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((m ? m[1] : text).trim());
}

/* ============================== 1. SINH CÂU HỎI ============================== */

const SYSTEM_PROMPT = `あなたはJFT-Basic（国際交流基金日本語基礎テスト）の作問専門家であり、教材『いろどり 生活の日本語』に精通しています。
規則:
- 語彙・漢字・文法は与えられた「いろどりシラバス」の範囲内のみを使用する。範囲外の語は使わない。
- A1〜A2レベル、外国人が日本で生活・就労する場面（買い物、交通、職場、病院、役所など）。
- 選択肢は4つ。正答は1つのみ。誤答（ディストラクター）は学習者が実際に間違えやすいもの（似た形、似た意味、助詞の混同、同じ漢字の別の読み）にする。
- 正答位置はA〜Dに偏らないよう分散させる。
- 聴解はScriptに話者ラベル付き会話を書く（形式: "F: …\\nM: …"、ナレーションは "N: …"）。自然な話し言葉で、実際のJFTと同程度の長さ。
- 画像が必要な問題はImagePromptに、白黒線画のイラスト指示を英語で具体的に書く（人物・物・配置・文字を明記）。選択肢が絵の場合は "4-panel: A) … B) … C) … D) …" の形式。
- Explanation_VIはベトナム語で、正答の理由と各誤答が誤りである理由を簡潔に書く。
- 出力はJSON配列のみ。説明文は不要。`;

function generateQuestions() {
  const cfg = config_();
  const books = String(cfg.BOOK_SCOPE).split(',').map(s => s.trim());
  const syl = sheetObjects_(SHEETS.SYLLABUS).filter(r =>
    books.includes(String(r.Book)) && r.Lesson >= cfg.LESSON_FROM && r.Lesson <= cfg.LESSON_TO);
  if (!syl.length) throw new Error('SYLLABUS_IRODORI chưa có dữ liệu trong phạm vi CONFIG.');

  const sylText = syl.map(r =>
    `[${r.Book} 第${r.Lesson}課] ${r.Topic}\nCan-do: ${r['Can-do']}\n語彙: ${r.Vocab}\n漢字: ${r.Kanji}\n文法: ${r.Grammar}`
  ).join('\n\n');

  const bank = SpreadsheetApp.getActive().getSheetByName(SHEETS.BANK);
  const jobs = sheetObjects_(SHEETS.BLUEPRINT).filter(r => r['Run?'] === true);
  if (!jobs.length) throw new Error('Chưa tick dòng nào ở BLUEPRINT.');

  jobs.forEach(job => {
    const user = `# いろどりシラバス（出題範囲）\n${sylText}\n\n# 作問指示
セクション: ${job.Section}
問題形式: ${job.Type}（${job['Mô tả dạng bài']}）
問題数: ${job['Số câu sinh/lần']}
画像: ${job['Cần ảnh?'] === 'Y' ? '必要' : '不要'} / 音声: ${job['Cần audio?'] === 'Y' ? '必要（Scriptを書く）' : '不要'}

各問題を次のキーを持つJSONオブジェクトにすること:
{"Book":"入門","Lesson":3,"Stem":"問題文","Script":"","OptionA":"","OptionB":"","OptionC":"","OptionD":"","Answer":"A","Explanation_VI":"","ImagePrompt":""}`;

    const items = parseJson_(callClaude_(SYSTEM_PROMPT, user));
    const now = new Date();
    const rows = items.map((q, i) => [
      `${job.Type}-${Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyMMddHHmmss')}-${i + 1}`,
      job.Section, job.Type, q.Book, q.Lesson, q.Stem, q.Script || '',
      q.OptionA, q.OptionB, q.OptionC, q.OptionD, q.Answer,
      q.Explanation_VI, q.ImagePrompt || '', '', '', 'Draft', now,
    ]);
    if (rows.length) bank.getRange(bank.getLastRow() + 1, 1, rows.length, BANK_HEADERS.length).setValues(rows);
    setCell_(SHEETS.BLUEPRINT, job._row, 'Run?', false);
  });
  SpreadsheetApp.getUi().alert('✅ Đã sinh xong. Câu mới ở trạng thái Draft — GV duyệt rồi đổi Status = Approved.');
}

/* ============================== 2. AUDIO (Google Cloud TTS) ============================== */

function generateAudio() {
  const cfg = config_();
  const dir = folder_('audio');
  const todo = sheetObjects_(SHEETS.BANK).filter(q => q.Script && !q.AudioURL);
  todo.forEach(q => {
    const blobs = [];
    String(q.Script).split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
      const m = line.match(/^([FMN])\s*[:：]\s*(.*)$/);
      const speaker = m ? m[1] : 'N';
      const text = m ? m[2] : line;
      const voice = speaker === 'M' ? cfg.TTS_VOICE_M : cfg.TTS_VOICE_F;
      blobs.push(tts_(text, voice, cfg.TTS_RATE));
    });
    // Ghép MP3 theo frame (cùng sample rate/bitrate nên phát liền mạch)
    const bytes = [].concat(...blobs.map(b => b.getBytes()));
    const file = dir.createFile(Utilities.newBlob(bytes, 'audio/mpeg', q.ID + '.mp3'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    setCell_(SHEETS.BANK, q._row, 'AudioURL', file.getUrl());
  });
  SpreadsheetApp.getUi().alert(`✅ Đã tạo ${todo.length} file audio.`);
}

function tts_(text, voiceName, rate) {
  const ssml = `<speak>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}<break time="700ms"/></speak>`;
  const res = UrlFetchApp.fetch(
    'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + prop_('GCP_TTS_API_KEY'), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        input: voiceName.indexOf('Chirp') >= 0 ? { text: text } : { ssml: ssml },
        voice: { languageCode: 'ja-JP', name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: Number(rate) || 1, sampleRateHertz: 24000 },
      }),
      muteHttpExceptions: true,
    });
  if (res.getResponseCode() !== 200) throw new Error('TTS: ' + res.getContentText());
  return Utilities.newBlob(Utilities.base64Decode(JSON.parse(res.getContentText()).audioContent), 'audio/mpeg');
}

/* ============================== 3. HÌNH MINH HOẠ (Claude → SVG) ============================== */

const SVG_PROMPT = `You are an illustrator for Japanese language exams (JFT-Basic style).
Draw clean black-and-white line art as a single valid SVG (viewBox="0 0 800 600", white background,
stroke="#222", stroke-width 3, no gradients, no external fonts/images). Use font-family="Noto Sans JP, sans-serif" for any Japanese text.
For "4-panel" prompts: 2x2 grid, each panel labeled A/B/C/D at top-left in a circle.
Return ONLY the SVG markup.`;

function generateImages() {
  const dir = folder_('images');
  const todo = sheetObjects_(SHEETS.BANK).filter(q => q.ImagePrompt && !q.ImageURL).slice(0, 15); // tránh timeout 6 phút
  todo.forEach(q => {
    const svg = callClaude_(SVG_PROMPT, q.ImagePrompt, 12000).match(/<svg[\s\S]*<\/svg>/);
    if (!svg) return;
    const file = dir.createFile(Utilities.newBlob(svg[0], 'image/svg+xml', q.ID + '.svg'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    setCell_(SHEETS.BANK, q._row, 'ImageURL', file.getUrl());
  });
  SpreadsheetApp.getUi().alert(`✅ Đã vẽ ${todo.length} hình (SVG). Chạy tools/svg2png để có PNG cho LMS.`);
}

/* ============================== 4. XUẤT FILE IMPORT LMS ============================== */

// Đúng mẫu "MULTIPLE CHOICE (Advanced)" của Mankai LMS — không đổi tên sheet/cột.
const LMS_SHEET = 'MULTIPLE CHOICE (Advanced)';
const LMS_HEADERS = ['Audio Url', 'Content', 'Correct Answer', 'Explanation', 'Image Url',
  'Option 1', 'Option 2', 'Option 3', 'Option 4', 'STT', 'Tag'];

function exportLmsXlsx() {
  const cfg = config_();
  const approved = sheetObjects_(SHEETS.BANK).filter(q => q.Status === 'Approved');
  const picked = [];
  sheetObjects_(SHEETS.BLUEPRINT).forEach(b => {
    const pool = approved.filter(q => q.Type === b.Type).sort(() => Math.random() - 0.5);
    picked.push(...pool.slice(0, Number(b['Số câu/đề']) || 0));
  });
  if (!picked.length) throw new Error('Chưa có câu Approved trong QUESTION_BANK.');

  const rows = picked.map((q, i) => [
    directAudioUrl_(q.AudioURL),
    q.Stem,
    'ABCD'.indexOf(String(q.Answer).trim().toUpperCase()) + 1,   // LMS dùng số 1–4
    q.Explanation_VI,
    directImageUrl_(q),
    q.OptionA, q.OptionB, q.OptionC, q.OptionD,
    i + 1,
    ['JFT', q.Section, q.Type, `${q.Book}L${q.Lesson}`].join('|'),
  ]);
  const bad = rows.filter(r => r[2] < 1);
  if (bad.length) throw new Error('Có câu sai định dạng Answer (phải là A/B/C/D): STT ' + bad.map(r => r[9]).join(','));

  const title = `${cfg.EXAM_TITLE} ${Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmm')}`;
  const tmp = SpreadsheetApp.create(title);
  const sh = tmp.getSheets()[0].setName(LMS_SHEET);
  sh.getRange(1, 1, 1, LMS_HEADERS.length).setValues([LMS_HEADERS]);
  sh.getRange(2, 1, rows.length, LMS_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();

  const xlsx = UrlFetchApp.fetch(
    `https://docs.google.com/spreadsheets/d/${tmp.getId()}/export?format=xlsx`,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(title + '.xlsx');
  const file = folder_('exams').createFile(xlsx);
  DriveApp.getFileById(tmp.getId()).setTrashed(true);

  SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG).appendRow([
    new Date(), title, file.getUrl(), '', picked.length, picked.map(q => q.ID).join(','),
  ]);
  SpreadsheetApp.getUi().alert('✅ File import LMS: ' + file.getUrl());
}

function driveId_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

/* Link trực tiếp để LMS phát/hiển thị được (link /view của Drive là trang HTML, không phải file). */
function directAudioUrl_(url) {
  const id = driveId_(url);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : '';
}

/* Ưu tiên PNG cùng tên ID trong thư mục images (do tools/svg2png tạo), không có thì dùng SVG. */
function directImageUrl_(q) {
  if (!q.ImageURL) return '';
  const it = folder_('images').getFilesByName(q.ID + '.png');
  let id = driveId_(q.ImageURL);
  if (it.hasNext()) {
    const png = it.next();
    png.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    id = png.getId();
  }
  return 'https://lh3.googleusercontent.com/d/' + id;
}
