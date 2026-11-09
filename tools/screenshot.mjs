// Renders the scene in the local Chrome (GPU on) and saves screenshots for review.
// usage: node tools/screenshot.mjs <outDir> "<query>|<name>" ...   (dev server must be running)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:5173/';
const [outDir, ...shots] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: Number(process.env.W || 1600), height: Number(process.env.H || 900) },
});
for (const s of shots.length ? shots : ['|default']) {
  const [query, name] = s.split('|');
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`.slice(0, 2000));
  });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  const t0 = Date.now();
  await page.goto(BASE + (query ? '?' + query : ''), { waitUntil: 'load', timeout: 120000 });
  try {
    await page.waitForFunction('window.__ready || window.__error', { timeout: 180000 });
  } catch (e) {
    logs.push('timeout waiting for ready');
  }
  const err = await page.evaluate('window.__error');
  if (err) logs.push('[__error] ' + err);
  await new Promise((r) => setTimeout(r, Number(process.env.WAIT || 2500)));
  const stats = await page.evaluate('window.__stats ? JSON.stringify(window.__stats) : ""');
  const file = path.join(outDir, `${name || 'shot'}.png`);
  await page.screenshot({ path: file });
  console.log(`${file}  load ${((Date.now() - t0) / 1000).toFixed(1)}s ${stats}`);
  for (const l of logs.slice(0, 15)) console.log('   ', l);
  await page.close();
}
await browser.close();
