// Chuyển toàn bộ *.svg trong 1 thư mục sang *.png (1600x1200) bằng Chromium có sẵn.
// Dùng: node tools/svg2png.mjs <thư_mục_svg>
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Usage: node tools/svg2png.mjs <dir>'); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
for (const f of readdirSync(dir).filter(f => f.endsWith('.svg'))) {
  const svg = readFileSync(join(dir, f), 'utf8');
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap" rel="stylesheet"><style>body{margin:0}svg{width:800px;height:600px}</style></head><body>${svg}</body></html>`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(dir, f.replace(/\.svg$/, '.png')) });
  console.log('✔', f);
}
await browser.close();
