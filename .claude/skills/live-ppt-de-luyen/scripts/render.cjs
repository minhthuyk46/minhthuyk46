// Chụp từng file HTML 1080x1920 thành PNG. node render.cjs <thư_mục_html>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2]);
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: +(process.env.W||1920), height: +(process.env.H||1080) } });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
  for (const f of files) {
    await pg.goto('file://' + path.join(dir, f));
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(dir, f.replace('.html', '.png')) });
  }
  await b.close();
  console.log(`rendered ${files.length}`);
})();
