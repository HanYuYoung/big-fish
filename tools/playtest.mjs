// Plays the game with a simple bot (swim to the nearest edible fish, shy away from
// predators) and saves screenshots along the way.
// usage: node tools/playtest.mjs <outDir> <seconds> [query] [shotEverySeconds]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, secs = '30', query = 'play', every = '6'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto((process.env.BASE || 'http://localhost:5173/') + '?' + query, { waitUntil: 'load' });
await page.waitForFunction('window.__ready || window.__error', { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game;
  window.__bot = setInterval(() => {
    if (g.state === 'complete' || g.state === 'paused') return;
    const P = g.player;
    if (!P.alive) return;
    let best = null, bd = 1e9, threat = null, td = 1e9;
    for (const c of g.creatures) {
      if (!c.alive || c.dying) continue;
      const d = c.pos.distanceTo(P.pos);
      const edible = P.size * 0.92 > c.size && !(c.ai && c.ai.never) && !(c.sp && c.sp.puffer && c.inflate > 0.3) && c.id !== 'jelly';
      if (edible && d < bd) (bd = d), (best = c);
      if (!edible && (c.id === 'jelly' || (c.sp && c.sp.venom) || (c.ai && c.ai.predator && c.size * 0.92 > P.size)) && d < td) (td = d), (threat = c);
    }
    let tx = P.pos.x, ty = P.pos.y;
    if (best) (tx = best.pos.x), (ty = best.pos.y);
    if (threat && td < 6 + threat.size) {
      tx = P.pos.x + (P.pos.x - threat.pos.x) * 2;
      ty = P.pos.y + (P.pos.y - threat.pos.y) * 2;
    }
    const v = new (P.pos.constructor)(tx, ty);
    // aim the pointer at the target, as a player would
    const cam = g.camera;
    const p3 = cam.position.clone();
    p3.set(v.x, v.y, 0).project(cam);
    g.setPointer((p3.x * 0.5 + 0.5) * innerWidth, (-p3.y * 0.5 + 0.5) * innerHeight);
    P.wantBoost = !!best && bd > 3 && bd < 12;
  }, 100);
  // auto-continue through clear panels
  window.__auto = setInterval(() => {
    const b = document.querySelector('#card [data-a="next"], #card [data-a="endless"], #card [data-a="restart"]');
    if (b && document.getElementById('panel').classList.contains('show')) b.click();
  }, 1500);
});
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 1000 < Number(secs)) {
  await new Promise((r) => setTimeout(r, Number(every) * 1000));
  const st = await page.evaluate(() => {
    const g = window.__game;
    return { t: Math.round(g.levelTime), lvl: g.levelIndex + 1, state: g.state, score: g.score, size: +g.player.size.toFixed(2), lives: g.lives, fish: g.creatures.length, eaten: g.eaten, tier: g.tier, fps: window.__stats?.fps };
  });
  const f = path.join(outDir, `play${String(k++).padStart(2, '0')}.png`);
  await page.screenshot({ path: f });
  console.log(path.basename(f), JSON.stringify(st));
}
for (const l of logs.slice(0, 20)) console.log('  ', l);
await browser.close();
