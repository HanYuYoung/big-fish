import puppeteer from 'puppeteer-core';
const lvl = process.argv[2] || '4';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.goto('http://localhost:5173/?level=' + lvl + '&god', { waitUntil: 'load' });
await p.waitForFunction('window.__ready');
const r = await p.evaluate(async () => {
  const g = window.__game, THREE = g.camera.position.constructor;
  const log = [];
  const born = new Map();
  const add = g.addCreature.bind(g), rem = g.removeCreature.bind(g);
  const onScreen = (c) => {
    const v = new THREE(c.pos.x, c.pos.y, c.z).project(g.camera);
    return Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  };
  g.addCreature = (...a) => { const c = add(...a); born.set(c, { t: performance.now(), seen: onScreen(c) }); return c; };
  g.removeCreature = (c, now) => {
    const bInfo = born.get(c);
    if (bInfo && !c.dying) log.push({ id: c.id, life: (performance.now() - bInfo.t) / 1000, bornOn: bInfo.seen, diesOn: onScreen(c) });
    return rem(c, now);
  };
  // visibility toggles on screen
  let vis = 0, frames = 0;
  const P = g.player;
  // wander the player left and right like a person would
  const t0 = performance.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      P.target.set(Math.sin(t * 0.25) * 50, Math.sin(t * 0.7) * 6);
      P.useKeys = 0;
      for (const c of g.creatures) {
        const m = c.model.group;
        if (m.userData.v !== undefined && m.userData.v !== m.visible && onScreen(c)) vis++;
        m.userData.v = m.visible;
      }
      frames++;
      if (t > 30) { clearInterval(iv); res(); }
    }, 16);
  });
  g.state = 'paused';
  const onscreenRemovals = log.filter((l) => l.diesOn);
  const short = log.filter((l) => l.life < 2);
  return { removed: log.length, onscreenRemovals: onscreenRemovals.slice(0, 10), short: short.length, shortOn: short.filter((s) => s.bornOn).length, vis };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
