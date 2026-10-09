// Chạy thử toàn vòng: kế hoạch → phiếu → brief → dán JSON → ngân hàng → QC → cần sửa → sửa → đạt → hình → audio → xuất LMS
const { makeEnv } = require('./mock.cjs');
const assert = require('assert');
let step = 0;
const ok = m => console.log('✔ ' + (++step) + '. ' + m);

const BANK_H = ['Mã câu','Mã nhóm (bài đọc/audio chung)','Mã YC','Dạng','Pool','Cấp','Bài','Mục tiêu','Nguồn (file/sheet/hàng)','Yêu cầu JP','Yêu cầu VI','Tình huống JP','Tình huống VI','Nội dung kiểm tra (câu/hội thoại; từ đích đặt trong 【】)','Câu hỏi','Số lựa chọn','Lựa chọn 1','Lựa chọn 2','Lựa chọn 3','Lựa chọn 4','Đáp án (số)','Lý do phương án nhiễu','Căn cứ đáp án','Giải thích VI','Brief hình','Mã asset hình','URL hình','Script audio (nhãn vai)','URL audio','Người soạn / công cụ','Loại nguồn (Sách / Chuyển thể / Bổ sung theo chủ đề)','QC VN','Nhận xét VN','QC JP','Nhận xét JP','Loại lỗi','Trạng thái','p (tỉ lệ đúng)','D (độ phân biệt)','Số lần dùng','Phiên bản'];
const YC_H = ['Mã YC','Dạng','Pool','Mã đề (nếu có)','Cấp','Bài','Mục tiêu chính','Nguồn (file / sheet / hàng)','Tình huống & yêu cầu (ghi rõ ngôn ngữ)','Số đơn vị cần sinh','Ghi chú cho AI / người soạn','Người giao','Người làm','Deadline','Trạng thái','Số câu đã sinh','Số câu Approved','Mã đợt (07_KE_HOACH)'];
const dangRow = (ma, ten, tt, soLC, soCau, nguon, ycvi) => { const r = new Array(20).fill(''); Object.assign(r, { 0: ma, 1: ten, 3: tt, 5: soLC, 6: soCau, 7: nguon, 16: ycvi, 17: 'tiêu chí ' + ma, 19: 'quy định ' + ma }); return r; };
const mt = Array.from({ length: 114 }, () => []);
mt[59] = ['', '', '', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '3-1', '3-2', '3-3', '4-1', '4-2'];
mt[60 + 4] = ['A1', 5, '入門', true, false, false, false, false, false, false, false, true, false, false];   // dòng 65 = A1 bài 5
const kh = [['KẾ HOẠCH'], ['Chi phí', 0, 'Tối đa', 30, 'Tự chạy', 'Tắt'], ['…'], ['Mã đợt'],
  ['KH-T', 'Thử', 'A1', 5, 5, '1-1,3-3', 'Luyện tập', 2, '', '', 'Minh Thuỳ', 'thử', 'Duyệt kế hoạch']];

const env = makeEnv({
  '03_DANG_BAI': [new Array(20).fill('h'), dangRow('1-1', 'Dạng 1', 'Nhìn tranh chọn từ', 3, 1, 'SRC_1-1', 'Nhìn hình và chọn một từ phù hợp nhất.'),
    dangRow('3-3', 'Dạng 9', 'Nghe chỉ thị/thông báo', 3, 2, 'SRC_3', '(Câu hỏi VI)')],
  '04_MA_TRAN_PHU': mt,
  '06_NHAT_KY': [['Thời gian', 'Người chạy', 'Thao tác', 'Đối tượng', 'Kết quả', 'Chi tiết']],
  '07_KE_HOACH': kh,
  '10_YEU_CAU': [YC_H],
  '14_CHU_DE_THEO_BAI': [['Cấp', 'Bài'], ['A1', '5', '食事・食べ物', '暮らす', '', 'hỏi bữa sáng']],
  '15_NGU_LIEU_BO_SUNG': [['Mã'], ['NL-0064', 'A1', '5', '3-3', '食事', 'Căng tin', 'Thông báo loa', 'Món hôm nay', '(1) món (2) đồ uống', 'A1-5', 'A1, bài 1–5', 'Bổ sung', 'Claude', 'Đã duyệt']],
  '20_NGAN_HANG': [BANK_H],
  '31_RAP_DE': [['Mã đề', 'STT', 'Mã câu']],
  'SRC_1-1': [['Cấp', 'STT', 'Bài', 'Từ vựng', 'Cách đọc', 'Từ gốc', 'Loại', 'Nghĩa', 'Dấu hiệu'],
    ['A1', 4, 'Bài 4', '家族', 'かぞく', '', 'N', 'Gia đình', '…'],
    ['A1', 7, 'Bài 5', 'お茶', 'おちゃ', '', 'N', 'Trà xanh', 'Tách trà gốm xanh'],
    ['A1', 8, 'Bài 5', '水', 'みず', '', 'N', 'Nước', 'Cốc nước']],
}, { props: { DRIVE_FOLDER_ID: 'ROOT', GEMINI_API_KEY: 'k' } });
const A = env.__api, ss = env.ss;
const T = n => A.table_(n);
const cell = (n, rowIdx, prefix) => { const t = T(n); return t.rows[rowIdx][A.col_(t, prefix)]; };
const colNum = (n, prefix) => A.col_(T(n), prefix) + 1;

// 1. Cài đặt
A.caiDat();
assert(colNum('10_YEU_CAU', 'Brief cho ChatGPT') > 0 && colNum('20_NGAN_HANG', 'Brief sửa') > 0);
ss.getSheetByName('08_PROMPT').getRange(2, 1, 4, 2).setValues([['CHUNG', 'QUY TẮC CHUNG JFT'], ['1-1', 'PROMPT 1-1'], ['3-3', 'PROMPT 3-3'], ['SUA', 'PROMPT SỬA']]);
ss.getSheetByName('08_PROMPT').getRange(6, 1, 1, 2).setValues([['VE_TRANH', 'Phong cách tranh phẳng, không chữ']]);
ss.getSheetByName('09_KHO_HINH').getRange(2, 1, 1, 6).setValues([['H001', 'A1', 5, 'Irodori A1 tr.60', 'Tách trà gốm xanh', 'お茶']]);
ok('caiDat: thêm cột Brief/Kết quả/Lỗi, tab 08_PROMPT, 09_KHO_HINH');

// 2. Kế hoạch → phiếu
A.taoPhieuTuKeHoach();
let yc = T('10_YEU_CAU');
assert.strictEqual(yc.rows.length, 2);
assert.strictEqual(JSON.stringify(yc.rows.map(r => [r[0], r[1], r[14]])), JSON.stringify([['YC-0001', '1-1', 'Chờ tạo'], ['YC-0002', '3-3', 'Chờ tạo']]));
assert.strictEqual(ss.getSheetByName('07_KE_HOACH').getRange('M5').getValue(), 'Đã tạo phiếu');
ok('Kế hoạch KH-T → 2 phiếu "Chờ tạo" (1-1: 2 câu; 3-3: 1 nhóm = 2 câu)');

// 3. Brief (chưa có file hình → kho chưa có link → brief báo "chưa có hình sách")
env.__mkFile('H001.png', 'kho_hinh', {});
A.chayTuDong();
yc = T('10_YEU_CAU');
const brief1 = cell('10_YEU_CAU', 0, 'Brief cho ChatGPT');
assert.strictEqual(cell('10_YEU_CAU', 0, 'Trạng thái'), 'Chờ sản xuất');
assert(brief1.includes('QUY TẮC CHUNG JFT') && brief1.includes('PROMPT 1-1') && brief1.includes('お茶（おちゃ）') && brief1.includes('家族'));
assert(brief1.includes('H001') && brief1.includes('VIẾT ĐÚNG 2 CÂU') && brief1.includes('QD-12'));
assert(T('09_KHO_HINH').rows[0][6].includes('uc?export=view'), 'gắn link hình kho');
const brief2 = cell('10_YEU_CAU', 1, 'Brief cho ChatGPT');
assert(brief2.includes('NL-0064') && brief2.includes('1 nhóm'));
ok('Brief: đủ prompt CHUNG + dạng, mục nguồn bài 5, từ bài trước làm nhiễu, kho hình H001 (đã tự gắn link), NL-0064');

// 4. Dán JSON hỏng → báo lỗi, không ghi gì
const cKQ = colNum('10_YEU_CAU', 'Kết quả ChatGPT');
env.edit('10_YEU_CAU', 2, cKQ, '```json {"cau_hoi": [ {"dang": "1-1", ');
assert(cell('10_YEU_CAU', 0, 'Lỗi').startsWith('JSON hỏng'));
assert.strictEqual(T('20_NGAN_HANG').rows.length, 0);
ok('JSON bị cắt → cột Lỗi: "JSON hỏng – yêu cầu ChatGPT trả lại ĐỦ JSON", ngân hàng không đổi');

// 5. Dán JSON 2 câu (1 đúng, 1 sai) → nhận 1, phiếu quay về Chờ tạo để soạn lượt 2
const q11 = (word, opts, da, extra) => Object.assign({ dang: '1-1', nguon: 'SRC_1-1', yeu_cau_jp: '絵を見て…', yeu_cau_vi: 'Nhìn hình…', noi_dung: '[Tranh]', lua_chon: opts, dap_an: da, giai_thich_vi: 'vì…', ma_hinh: 'H001' }, extra || {});
env.edit('10_YEU_CAU', 2, cKQ, '“' + 'ok' + '”' + JSON.stringify({ cau_hoi: [q11('お茶', ['コーヒー', 'お茶', '水'], 2), q11('x', ['a', 'a', 'b'], 5)] }));
let bank = T('20_NGAN_HANG');
assert.strictEqual(bank.rows.length, 1);
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Trạng thái'), 'Chờ QC VN');
assert(cell('20_NGAN_HANG', 0, 'URL hình').includes('uc?export=view'), 'câu dùng H001 có link hình');
assert(cell('10_YEU_CAU', 0, 'Lỗi').includes('lựa chọn trùng') && cell('10_YEU_CAU', 0, 'Lỗi').includes('đáp án ngoài'));
assert.strictEqual(cell('10_YEU_CAU', 0, 'Trạng thái'), 'Chờ tạo');
assert.strictEqual(cell('10_YEU_CAU', 0, 'Kết quả ChatGPT (dán JSON)'), '');
ok('JSON 2 câu: nhận 1 câu đúng (gắn hình H001), bỏ 1 câu sai (ghi lý do), phiếu quay lại "Chờ tạo"');

// 6. Lượt 2: brief mới 1 câu, có danh sách câu đã có; câu không ma_hinh → prompt vẽ
A.chayTuDong();
const brief1b = cell('10_YEU_CAU', 0, 'Brief cho ChatGPT');
assert(brief1b.includes('LƯỢT 2') && brief1b.includes('VIẾT ĐÚNG 1 CÂU') && brief1b.includes('CÂU ĐÃ CÓ'));
env.edit('10_YEU_CAU', 2, cKQ, JSON.stringify({ cau_hoi: [q11('水', ['水', 'お茶', 'パン'], 1, { ma_hinh: '', brief_hinh: 'Cốc nước thuỷ tinh trong suốt' })] }));
assert.strictEqual(T('20_NGAN_HANG').rows.length, 2);
assert.strictEqual(cell('10_YEU_CAU', 0, 'Trạng thái'), 'Chờ duyệt');
assert(cell('20_NGAN_HANG', 1, 'Prompt vẽ tranh').includes('Phong cách tranh phẳng') && cell('20_NGAN_HANG', 1, 'Prompt vẽ tranh').includes('Cốc nước'));
ok('Lượt 2: brief "1 câu" + câu đã có; câu không có hình sách → tự soạn "Prompt vẽ tranh" cho ChatGPT; phiếu "Chờ duyệt"');

// 7. Nhóm 3-3: thiếu nguon hợp lệ → bỏ; đúng → 2 câu cùng mã nhóm
const q33 = (k, extra) => Object.assign({ dang: '3-3', nguon: 'NL-0064', yeu_cau_vi: 'Nghe…', tinh_huong_vi: 'Ở căng tin…', cau_hoi: '(' + k + ') …?', lua_chon: ['1', '2', '3'], dap_an: k, giai_thich_vi: '…', brief_hinh: '3 khung…' }, extra || {});
env.edit('10_YEU_CAU', 3, cKQ, JSON.stringify({ cau_hoi: [q33(1, { script_audio: 'N：しょくどうから おしらせです。\nF：きょうは さかなです。\nM：のみものは おちゃです。' }), q33(2)] }));
bank = T('20_NGAN_HANG');
assert.strictEqual(bank.rows.length, 4);
const g1 = cell('20_NGAN_HANG', 2, 'Mã nhóm'), g2 = cell('20_NGAN_HANG', 3, 'Mã nhóm');
assert(g1 && g1 === g2 && g1.startsWith('G-'));
assert.strictEqual(cell('10_YEU_CAU', 1, 'Trạng thái'), 'Chờ duyệt');
ok('3-3: 2 câu nhận cùng mã nhóm ' + g1 + ' (câu 2 dùng chung script), phiếu "Chờ duyệt"');

// 8. QC: VN Đạt → Chờ QC JP; JP Cần sửa + nhận xét → Cần sửa + brief sửa
const cVN = colNum('20_NGAN_HANG', 'QC VN'), cJP = colNum('20_NGAN_HANG', 'QC JP'), cNXJ = colNum('20_NGAN_HANG', 'Nhận xét JP');
env.edit('20_NGAN_HANG', 2, cVN, 'Đạt');
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Trạng thái'), 'Chờ QC JP');
ss.getSheetByName('20_NGAN_HANG').getRange(2, cNXJ).setValue('Nhiễu コーヒー quá dễ loại');
env.edit('20_NGAN_HANG', 2, cJP, 'Cần sửa');
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Trạng thái'), 'Cần sửa');
const bs = cell('20_NGAN_HANG', 0, 'Brief sửa');
assert(bs.includes('PROMPT SỬA') && bs.includes('Nhiễu コーヒー quá dễ loại') && bs.includes('"noi_dung"'));
ok('QC: VN Đạt → Chờ QC JP; JP Cần sửa + nhận xét → tự soạn "Brief sửa" (kèm câu hiện tại + nhận xét)');

// 9. Dán bản sửa → về Chờ QC VN, v2, xoá QC cũ
env.edit('20_NGAN_HANG', 2, colNum('20_NGAN_HANG', 'Kết quả sửa'), JSON.stringify({ cau_hoi: [q11('お茶', ['こうちゃ', 'お茶', 'みず'], 2)] }));
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Trạng thái'), 'Chờ QC VN');
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Phiên bản'), 'v2');
assert.strictEqual(cell('20_NGAN_HANG', 0, 'Lựa chọn 1'), 'こうちゃ');
assert.strictEqual(cell('20_NGAN_HANG', 0, 'QC JP'), '');
ok('Bản sửa: ghi đè nội dung, phiên bản v2, xoá QC cũ, về "Chờ QC VN"');

// 10. Duyệt hết → Đạt; phiếu 1-1 Hoàn thành
[2, 3, 4, 5].forEach(r => { env.edit('20_NGAN_HANG', r, cVN, 'Đạt'); env.edit('20_NGAN_HANG', r, cJP, 'Đạt'); });
A.chayTuDong();
assert(T('20_NGAN_HANG').rows.every(r => r[36] === 'Đạt'));
assert.strictEqual(cell('10_YEU_CAU', 0, 'Trạng thái'), 'Hoàn thành');
assert.strictEqual(cell('10_YEU_CAU', 1, 'Trạng thái'), 'Hoàn thành');
ok('Duyệt 2 bước → 4 câu "Đạt"; 2 phiếu → "Hoàn thành"');

// 11. Tranh ChatGPT vẽ: thả file JQ-0002.png vào kho_hinh → tự gắn
env.__mkFile('JQ-0002.png', 'kho_hinh', {});
A.chayTuDong();
assert(cell('20_NGAN_HANG', 1, 'URL hình').includes('uc?export=view'));
ok('Thả "JQ-0002.png" (tranh ChatGPT vẽ) vào folder kho_hinh → tự gắn URL hình cho câu JQ-0002');

// 12. Audio Gemini: 3 đoạn (N riêng, F+M chung) → 1 file WAV dùng chung cho nhóm
A.taoAudio();
const gem = env.__fetches.filter(f => /generativelanguage/.test(f.url)).map(f => JSON.parse(f.o.payload));
assert.strictEqual(gem.length, 2);
assert(gem[0].generationConfig.speechConfig.voiceConfig && gem[1].generationConfig.speechConfig.multiSpeakerVoiceConfig);
const u3 = cell('20_NGAN_HANG', 2, 'URL audio'), u4 = cell('20_NGAN_HANG', 3, 'URL audio');
assert(u3 && u3 === u4);
const wav = env.__files.find(f => /\.wav$/.test(f.name)).blob.bytes;
assert.strictEqual(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
assert.strictEqual(wav.length, 44 + 4800 * 2 + 24000 * 2 * 0.8);
ok('Audio: 2 lượt gọi Gemini (lời dẫn N 1 giọng + hội thoại F/M 2 giọng), ghép + 0,8 s nghỉ → 1 file WAV hợp lệ dùng chung cho nhóm');

// 13. Xuất LMS
const res = A.xuatLMS_('A1-05');
assert.strictEqual(res.rows.length, 5);
assert.strictEqual(JSON.stringify(res.rows[0]), JSON.stringify(['Audio Url', 'Content', 'Correct Answer', 'Explanation', 'Image Url', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'STT', 'Tag']));
const r1 = res.rows[1];
assert(r1[1].startsWith('Nhìn hình…\n絵を見て…') && r1[2] === 2 && r1[4] && r1[9] === 1 && r1[10] === 'JFT|1-1|A1-05|JQ-0001');
const r3 = res.rows[3];
assert(r3[0] && !r3[1].includes('おしらせ') && r3[5] === '1');
ok('Xuất LMS A1-05: 4 câu Đạt, đúng 11 cột mẫu; VI trước JP; câu nghe không lộ script; có Audio/Image Url');

console.log('\nTẤT CẢ ' + step + ' BƯỚC ĐẠT');
