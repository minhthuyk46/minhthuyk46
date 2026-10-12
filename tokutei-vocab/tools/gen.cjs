// node tools/gen.cjs > /tmp/out.json — chạy cùng logic Code.gs trên data/vocab.tsv
const fs = require('fs'), path = require('path');
const core = require(path.join(__dirname, '../apps-script/Code.gs'));
const lines = fs.readFileSync(path.join(__dirname, '../data/vocab.tsv'), 'utf8').trim().split('\n').slice(1);
const rows = lines.map(l => { const [stt, word, reading, meaning, lesson] = l.split('\t'); return { stt, word, reading: reading || '', meaning, lesson }; });
const g = core.groupByLesson_(rows);
const all = [].concat(...Object.values(g));
const out = Object.keys(g).sort(core.lessonSort_).map(n => ({
  lesson: n, flash: core.buildFlashcardRows(g[n]), quiz: core.buildQuizRows(g[n], all, n)
}));
process.stdout.write(JSON.stringify(out));
