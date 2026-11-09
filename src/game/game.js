import * as THREE from 'three';
import { G, WORLD } from '../core/globals.js';
import { LEVELS } from '../core/themes.js';
import { Rng, clamp, damp } from '../core/rng.js';
import { SPECIES } from '../fish/species.js';
import { iconFor } from '../fish/model.js';
import { floorY } from '../world/ocean.js';
import { Player, Fish, Jelly, makeCreature, EDGE } from './entities.js';

const $ = (id) => document.getElementById(id);
const BEST_KEY = 'bigfish.best';
const UNLOCK_KEY = 'bigfish.unlocked';
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八'];
const GROWTH = 0.5; // share of a meal's mass that becomes yours

function relevance(r) {
  if (r < 0.18) return 0.15;
  if (r < 0.4) return 0.4 + ((r - 0.18) / 0.22) * 0.6;
  if (r < EDGE) return 1.35;
  if (r < 1.35) return 0.7;
  if (r < 2.7) return 0.55;
  return 0.28;
}

export class Game {
  constructor({ scene, camera, ocean, fx, audio, pipe }) {
    Object.assign(this, { scene, camera, ocean, fx, audio, pipe });
    this.rng = new Rng(Date.now() & 0xffff);
    this.state = 'title';
    this.creatures = [];
    this.schools = [];
    this.player = new Player();
    scene.add(this.player.model.group);
    this.player.alive = false;
    this.player.model.group.visible = false;
    this.camPos = new THREE.Vector3(0, 0, 22);
    this.camLook = new THREE.Vector3();
    this.dist = 18;
    this.levelIndex = 0;
    this.score = 0;
    this.lives = 3;
    this.best = 0;
    this.unlocked = 1;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0);
      this.unlocked = Math.max(1, Math.min(LEVELS.length, Number(localStorage.getItem(UNLOCK_KEY) || 1)));
    } catch (e) {}
    this.spawnT = 0;
    this.timeScale = 1;
    this.t = 0;
    this.ndc = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.hud = {
      score: $('score'), combo: $('combo'), grow: $('growbar'), tier: $('tier'), chain: $('chain'), lives: $('lives'),
      lvlno: $('lvlno'), lvlname: $('lvlname'), boost: $('boostbar'), best: $('hudbest'), danger: $('danger'),
    };
    this.cursor = document.querySelector('#cursor i');
    this.bindUI();
    this.loadLevel(0, true);
    this.showBest();
  }

  // ---------------------------------------------------------------- UI
  bindUI() {
    const click = () => this.audio.click();
    $('play').onclick = () => {
      this.audio.start();
      click();
      this.startGame();
    };
    $('levels').onclick = () => {
      this.audio.start();
      click();
      this.levelSelect();
    };
    $('howto').onclick = () => {
      this.audio.start();
      click();
      this.panel(this.helpHTML() + `<div class="row"><button class="btn primary" data-a="close">知道了</button></div>`);
    };
    $('sound').onclick = () => {
      this.audio.start();
      const m = this.audio.toggle();
      $('sound').textContent = m ? '声音：关' : '声音：开';
    };
    $('pausebtn').onclick = () => this.pause();
    $('card').addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      click();
      if (a === 'close') this.closePanel();
      if (a === 'resume') this.resume();
      if (a === 'restart') {
        this.closePanel();
        this.startGame(this.levelIndex);
      }
      if (a === 'from1') {
        this.closePanel();
        this.startGame(0);
      }
      if (a === 'level') {
        const i = Number(e.target.closest('[data-i]').dataset.i);
        if (i < this.unlocked) {
          this.closePanel();
          this.startGame(i);
        }
      }
      if (a === 'title') this.toTitle();
      if (a === 'next') {
        this.closePanel();
        this.nextLevel();
      }
      if (a === 'endless') {
        this.closePanel();
        this.endless = true;
        this.state = 'play';
        document.body.classList.remove('menu');
      }
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.code === 'KeyM') {
        const m = this.audio.toggle();
        $('sound').textContent = m ? '声音：关' : '声音：开';
      }
    });
    addEventListener('blur', () => this.state === 'play' && this.pause());
    document.addEventListener('visibilitychange', () => document.hidden && this.state === 'play' && this.pause());
  }
  helpHTML() {
    return `<div class="kicker">HOW TO PLAY</div><h2>玩法说明</h2><div class="help">
      <p>🐟 <em>吃掉比你小的鱼</em>来长大，<em>躲开比你大的鱼</em>。</p>
      <p>顶部的食物链会亮起你现在能吃的鱼；成长条填满就能进入下一片海。</p>
      <p>短时间内连续吞食会触发<em>连吃加分</em>。河豚鼓起时会扎嘴，水母会蜇人。</p>
      <p>张开的巨蚌里有<em>珍珠</em>，打开的宝箱里有<em>金币</em>，碰到就能拿到额外分数。</p>
      <p>狮子鱼的毒刺碰不得；熔岩海沟的热泉<em>发红颤动</em>时马上就要喷发。</p>
      <p style="margin-top:12px"><kbd>鼠标</kbd> 游向光标　<kbd>W A S D</kbd> / <kbd>方向键</kbd> 也能游动</p>
      <p><kbd>按住左键</kbd> / <kbd>空格</kbd> 冲刺　<kbd>Esc</kbd> 暂停　<kbd>M</kbd> 静音</p></div>`;
  }
  panel(html, kind = '') {
    $('card').innerHTML = html;
    $('card').className = 'card ' + kind;
    $('panel').classList.add('show');
  }
  closePanel() {
    $('panel').classList.remove('show');
  }
  levelSelect() {
    const cards = LEVELS.map((L, i) => {
      const locked = i >= this.unlocked;
      const icon = Object.keys(L.fish).filter((id) => id !== 'jelly' && !SPECIES[id].ai.never).sort((a, b) => SPECIES[b].size - SPECIES[a].size)[0];
      return `<button class="lv lv-${L.key}${locked ? ' locked' : ''}" data-a="level" data-i="${i}" ${locked ? 'disabled' : ''}>
        <span class="no">${String(i + 1).padStart(2, '0')}</span><span class="nm">${L.name}</span><span class="en">${L.en}</span>
        <span class="boss" data-icon="${icon}"></span>${locked ? '<span class="lock">通关上一关解锁</span>' : ''}</button>`;
    }).join('');
    this.panel(`<div class="kicker">SELECT STAGE</div><h2>选择海域</h2><div class="lvgrid">${cards}</div>
      <div class="row"><button class="btn" data-a="close">返回</button></div>`, 'wide');
    // the top predator of each sea, drawn on its card
    $('card').querySelectorAll('.boss').forEach((el) => el.appendChild(cloneCanvas(iconFor(el.dataset.icon))));
  }
  showBest() {
    $('best').textContent = this.best ? `最高分　${this.best.toLocaleString()}` : '';
  }
  banner(k, n, g, ms = 2600) {
    $('bk').textContent = k;
    $('bn').textContent = n;
    $('bg').textContent = g;
    const b = $('banner');
    b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  flash(kind) {
    const f = $('flash');
    f.className = 'layer ' + kind;
    void f.offsetWidth;
    f.className = 'layer';
  }

  // ---------------------------------------------------------------- flow
  startGame(level = 0) {
    this.score = 0;
    this.lives = 3;
    this.endless = false;
    $('title').classList.add('hide');
    document.body.classList.remove('menu');
    $('hud').classList.add('show');
    this.loadLevel(level);
  }
  toTitle() {
    this.closePanel();
    this.state = 'title';
    document.body.classList.add('menu');
    $('title').classList.remove('hide');
    $('hud').classList.remove('show');
    this.loadLevel(0, true);
    this.showBest();
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    document.body.classList.add('menu');
    this.panel(`<div class="kicker">PAUSED</div><h2>暂停</h2><div style="height:22px"></div>
      <div class="row"><button class="btn primary" data-a="resume">继续</button><button class="btn" data-a="restart">重新开始</button><button class="btn" data-a="title">返回标题</button></div>`);
  }
  resume() {
    this.closePanel();
    this.state = 'play';
    document.body.classList.remove('menu');
  }
  nextLevel() {
    // a fresh sea gives back one lost life
    this.lives = Math.min(3, this.lives + 1);
    if (this.levelIndex + 1 < LEVELS.length) this.loadLevel(this.levelIndex + 1);
  }

  loadLevel(i, attract = false) {
    this.levelIndex = i;
    if (!attract) this.unlock(i + 1);
    const L = (this.level = LEVELS[i]);
    this.applyTheme(L);
    this.ocean.build(L, i + 1);
    for (const c of this.creatures) this.removeCreature(c, true);
    this.creatures = [];
    this.schools = [];
    this.fx.clear();
    this.audio.setKey(L.key);
    const P = this.player;
    P.setSize(L.start);
    P.pos.set(0, 2);
    P.vel.set(0, 0);
    P.target.copy(P.pos);
    P.stamina = 1;
    P.facing = 1;
    P.invuln = 0;
    P.stun = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.eaten = 0;
    this.pearls = 0;
    this.levelTime = 0;
    this.tier = 1;
    this.camPos.set(0, 2, 22);
    this.dist = 18;
    // a populated sea from the first frame
    for (let k = 0; k < 40; k++) this.spawn(true);
    if (attract) {
      this.state = 'title';
      P.alive = false;
      P.model.group.visible = false;
      return;
    }
    P.alive = true;
    P.invuln = 3;
    this.hunter = null;
    this.buildChain();
    this.updateLives();
    this.hud.lvlno.textContent = i + 1;
    this.hud.lvlname.textContent = L.name;
    this.state = 'play';
    this.banner(`第${NUM[i]}关 · ${L.en}`, L.name, L.goal);
  }

  applyTheme(L) {
    G.uShallow.value.set(...L.shallow);
    G.uDeep.value.set(...L.deep);
    G.uSunCol.value.set(...L.sun);
    G.uFogDen.value = L.fog;
    G.uCaust.value = L.caust;
    G.uBio.value = L.bio;
    G.uSnow.value = L.snow || 0;
    G.uLava.value = L.lava || 0;
    G.uIce.value = L.ice || 0;
    this.pipe.params.exposure = L.exposure;
    this.pipe.params.bloom = L.bio || L.lava ? 0.11 : 0.07;
  }

  // ---------------------------------------------------------------- spawning
  viewHalf() {
    const hh = this.dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return { hh, hw: hh * this.camera.aspect };
  }
  spawn(initial = false) {
    const L = this.level, P = this.player;
    const ps = P.alive ? P.size : L.start * 1.6;
    const counts = {};
    for (const c of this.creatures) counts[c.id] = (counts[c.id] || 0) + 1;
    const ids = Object.keys(L.fish);
    // pick the species furthest below its desired head-count
    let best = null, bestNeed = 0.5;
    for (const id of ids) {
      const sp = SPECIES[id];
      const size = id === 'jelly' ? 1.5 : sp.size;
      let want = L.fish[id] * (id === 'jelly' ? 1 : relevance(size / ps));
      if (id === 'shark') want = Math.min(want, 1);
      if (sp?.ai?.school) want *= 1.6;
      const need = want - (counts[id] || 0) * (sp?.ai?.school ? 0.25 : 1);
      if (need > bestNeed) {
        bestNeed = need;
        best = id;
      }
    }
    if (!best) return;
    const { hw } = this.viewHalf();
    const rng = this.rng;
    const sp = SPECIES[best];
    const size = best === 'jelly' ? rng.range(1.1, 1.9) : sp.size * rng.range(0.86, 1.14);
    let x, side;
    if (initial) {
      x = rng.range(-WORLD.W + 4, WORLD.W - 4);
      if (Math.abs(x - P.pos.x) < 9) x += 18 * Math.sign(x - P.pos.x || 1);
      side = Math.sign(x - this.camPos.x) || 1;
    } else {
      side = rng.next() < 0.65 ? P.facing || 1 : -(P.facing || 1);
      x = this.camPos.x + side * (hw + 3 + size);
      if (Math.abs(x) > WORLD.W + 6) {
        side = -side;
        x = this.camPos.x + side * (hw + 3 + size);
      }
    }
    const band = sp?.ai?.depth || [0.15, 0.85];
    const yTop = WORLD.SURFACE - 1.5 - band[0] * (WORLD.SURFACE - WORLD.FLOOR - 3);
    const yBot = Math.max(floorY(x) + 1.5 + size * 0.3, WORLD.SURFACE - 1.5 - band[1] * (WORLD.SURFACE - WORLD.FLOOR - 3));
    const y = rng.range(Math.min(yBot, yTop), yTop);
    const dir = -side;
    if (sp?.ai?.school) {
      const n = rng.int(6, 11);
      const school = { pos: new THREE.Vector2(x, y), vel: new THREE.Vector2(dir * sp.ai.cruise, 0), wander: 0, members: [], cruise: sp.ai.cruise };
      for (let k = 0; k < n; k++) {
        const f = this.addCreature(best, size * rng.range(0.9, 1.1), x + rng.range(-1.5, 1.5), y + rng.range(-1, 1), dir);
        f.school = school;
        f.offset.set(rng.range(-1.6, 1.6), rng.range(-0.9, 0.9)).multiplyScalar(0.6 + size);
        school.members.push(f);
      }
      this.schools.push(school);
      return;
    }
    const c = this.addCreature(best, size, x, y, dir);
    if (best === 'clown' && this.ocean.anemones.length) {
      const a = this.ocean.anemones[rng.int(0, this.ocean.anemones.length - 1)];
      c.home = new THREE.Vector2(a.x, a.y);
      if (initial) c.pos.set(a.x + rng.range(-2, 2), a.y + rng.range(0, 1.5));
    }
  }
  addCreature(id, size, x, y, dir) {
    const c = makeCreature(id, size, this.rng);
    c.pos.set(x, y);
    c.dir = dir;
    c.vel.set(dir * (c.ai?.cruise || 0.5), 0);
    c.facing = dir;
    c.yaw = dir > 0 ? -0.14 : -Math.PI + 0.14;
    this.scene.add(c.model.group);
    this.creatures.push(c);
    return c;
  }
  removeCreature(c, now = false) {
    c.alive = false;
    this.scene.remove(c.model.group);
    c.model.dispose();
    if (c.school) c.school.members = c.school.members.filter((m) => m !== c);
  }

  // ---------------------------------------------------------------- gameplay
  eat(c) {
    const P = this.player, L = this.level;
    c.dying = 0.001;
    P.chomp = 1;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 2.6;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = Math.min(this.combo, 8);
    const pts = (c.sp.points || 10) * mult;
    this.score += pts;
    this.eaten++;
    const before = P.size;
    P.grow(c.size * c.size * GROWTH * (L.growth ?? 1));
    P.model.setSize(P.size);
    this.fx.burst(c.pos.x, c.pos.y, c.size, c.sp.fin.map((v) => v * 0.8));
    this.fx.shake = Math.max(this.fx.shake, 0.08 + c.size * 0.04);
    this.audio.gulp(c.size, this.combo);
    this.fx.popup(`+${pts}`, c.pos.x, c.pos.y + c.size * 0.4, mult > 1 ? 'big' : '');
    if (this.combo >= 3 && this.combo % 2 === 1) this.fx.popup(`连吃 ×${this.combo}!`, P.pos.x, P.pos.y + P.size + 1, 'big');
    // a new rung on the food chain
    const tiers = L.tiers;
    let tier = 1;
    for (let k = 1; k < tiers.length - 1; k++) if (P.size >= tiers[k]) tier = k + 1;
    if (tier > this.tier) {
      this.tier = tier;
      this.audio.grow();
      this.flash('level');
      this.fx.sparkle(P.pos.x, P.pos.y, 1, 24, [2.4, 2.1, 1.2], 0.5);
      this.fx.popup('长大了！', P.pos.x, P.pos.y + P.size + 1.6, 'big');
    }
    this.refreshChain(before);
    if (!this.endless && this.state === 'play' && P.size >= tiers[tiers.length - 1]) this.levelComplete();
  }
  sting(src) {
    const P = this.player;
    P.stun = 0.9;
    P.invuln = 1.8;
    const away = P.pos.clone().sub(src.pos).normalize();
    P.vel.copy(away.multiplyScalar(9));
    P.shrink(0.07, this.level.start);
    P.model.setSize(P.size);
    P.flash = 1;
    if (src.model) src.flash = 1;
    this.combo = 0;
    this.comboT = 0;
    this.audio.sting();
    this.flash('hurt');
    this.fx.shake = 0.35;
    const ouch = { jelly: '被蜇了！', vent: '好烫！', lionfish: '中毒了！' }[src.id] || '扎嘴！';
    this.fx.popup(ouch, P.pos.x, P.pos.y + P.size + 0.8, 'bad');
    this.fx.sparkle(P.pos.x, P.pos.y, 1, 10, [2.5, 1.2, 2.2], 0.3);
  }
  playerEaten(pred) {
    const P = this.player;
    pred.chomp = 1;
    pred.rest = 3;
    P.alive = false;
    P.model.group.visible = false;
    this.lives--;
    this.updateLives();
    this.combo = 0;
    this.comboT = 0;
    this.audio.hurt();
    this.flash('hurt');
    this.pipe.params.hurt = 1;
    this.fx.shake = 0.8;
    this.fx.burst(P.pos.x, P.pos.y, P.size * 1.5, [1, 0.5, 0.2]);
    this.fx.popup(`被${pred.sp.name}吃掉了`, P.pos.x, P.pos.y + 1.5, 'bad');
    this.state = 'dead';
    this.deadT = 2.2;
  }
  respawn() {
    const P = this.player;
    const { hh } = this.viewHalf();
    P.pos.set(this.camPos.x, Math.min(WORLD.SURFACE - 2, this.camPos.y + hh * 0.5));
    P.vel.set(0, -2);
    P.target.copy(P.pos);
    P.alive = true;
    P.invuln = 3;
    P.stun = 0;
    P.stamina = 1;
    this.state = 'play';
    this.fx.bubble(P.pos.x, P.pos.y, 0.5, 20, 1, 2, 0.15);
  }
  levelComplete() {
    const L = this.level;
    const timeBonus = Math.max(0, Math.round((300 - this.levelTime) * 10));
    const bonus = 1000 * (this.levelIndex + 1) + timeBonus;
    this.score += bonus;
    this.state = 'complete';
    this.audio.levelUp();
    this.flash('level');
    this.fx.sparkle(this.player.pos.x, this.player.pos.y, 1, 60, [2.6, 2.2, 1.2], 0.7);
    this.saveBest();
    this.unlock(this.levelIndex + 2);
    const last = this.levelIndex === LEVELS.length - 1;
    setTimeout(() => {
      document.body.classList.add('menu');
      const stats = `<div class="stats"><div><b>${this.score.toLocaleString()}</b><span>总分</span></div><div><b>+${bonus.toLocaleString()}</b><span>过关奖励</span></div>
        <div><b>${this.eaten}</b><span>吞食</span></div><div><b>×${this.maxCombo}</b><span>最高连吃</span></div></div>`;
      if (last)
        this.panel(`<div class="kicker">VICTORY</div><h2>海洋霸主</h2><div class="sub">六片海域，全部征服</div>${this.newBestHTML()}${stats}
          <div class="row"><button class="btn primary" data-a="endless">继续畅游</button><button class="btn" data-a="title">返回标题</button></div>`);
      else
        this.panel(`<div class="kicker">STAGE CLEAR</div><h2>${L.name} · 完成</h2>${this.newBestHTML()}${stats}
          <div class="row"><button class="btn primary" data-a="next">前往 ${LEVELS[this.levelIndex + 1].name}</button></div>`);
    }, 1600);
  }
  gameOver() {
    this.state = 'over';
    this.saveBest();
    this.audio.gameOver();
    document.body.classList.add('menu');
    this.panel(`<div class="kicker">GAME OVER</div><h2>游戏结束</h2>${this.newBestHTML()}
      <div class="stats"><div><b>${this.score.toLocaleString()}</b><span>得分</span></div><div><b>${this.best.toLocaleString()}</b><span>最高分</span></div>
      <div><b>${LEVELS[this.levelIndex].name}</b><span>到达</span></div><div><b>×${this.maxCombo}</b><span>最高连吃</span></div></div>
      <div class="row"><button class="btn primary" data-a="restart">从本关重来</button>${this.levelIndex ? '<button class="btn" data-a="from1">从第一关开始</button>' : ''}<button class="btn" data-a="title">返回标题</button></div>`);
  }
  unlock(n) {
    if (n <= this.unlocked) return;
    this.unlocked = Math.min(LEVELS.length, n);
    try {
      localStorage.setItem(UNLOCK_KEY, String(this.unlocked));
    } catch (e) {}
  }
  saveBest() {
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch (e) {}
    }
  }
  newBestHTML() {
    return this.newBest ? `<div class="new">★ 新纪录 ★</div>` : '';
  }

  // ---------------------------------------------------------------- HUD
  buildChain() {
    const L = this.level;
    const el = this.hud.chain;
    el.innerHTML = '';
    const lo = L.tiers[0], hi = L.tiers[L.tiers.length - 1];
    const ids = Object.keys(L.fish).filter((id) => id !== 'jelly' && !SPECIES[id].ai.never).sort((a, b) => SPECIES[a].size - SPECIES[b].size);
    this.chainItems = ids.map((id) => {
      const d = document.createElement('div');
      d.className = 'ic';
      d.title = SPECIES[id].name;
      d.appendChild(cloneCanvas(iconFor(id)));
      const need = SPECIES[id].size / EDGE;
      d.style.left = clamp(((need - lo) / (hi - lo)) * 100, 3, 97) + '%';
      el.appendChild(d);
      return { id, el: d, need };
    });
    // the biggest fish on the chain is this sea's goal
    if (this.chainItems.length) this.chainItems[this.chainItems.length - 1].el.classList.add('goal');
    // tier ticks on the bar
    const bar = this.hud.grow.parentElement;
    bar.querySelectorAll('s').forEach((s) => s.remove());
    for (let k = 1; k < L.tiers.length - 1; k++) {
      const s = document.createElement('s');
      s.style.left = ((L.tiers[k] - lo) / (hi - lo)) * 100 + '%';
      bar.appendChild(s);
    }
    this.refreshChain(0);
  }
  refreshChain(before) {
    const P = this.player;
    const tiers = this.level.tiers;
    if (!before) for (let k = 1; k < tiers.length - 1; k++) if (P.size >= tiers[k]) this.tier = Math.max(this.tier, k + 1);
    for (const it of this.chainItems || []) {
      const ok = P.size >= it.need;
      if (ok && !it.el.classList.contains('ok') && before > 0) {
        it.el.classList.add('ok', 'pop');
        setTimeout(() => it.el.classList.remove('pop'), 700);
      } else it.el.classList.toggle('ok', ok);
    }
  }
  updateLives() {
    const el = this.hud.lives;
    el.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      if (i >= this.lives) s.className = 'lost';
      el.appendChild(s);
    }
  }
  updateHUD() {
    const L = this.level, P = this.player, h = this.hud;
    const lo = L.tiers[0], hi = L.tiers[L.tiers.length - 1];
    const s = this.score.toLocaleString();
    if (h.score.textContent !== s) h.score.textContent = s;
    const b = `最高 ${Math.max(this.best, this.score).toLocaleString()}`;
    if (h.best.textContent !== b) h.best.textContent = b;
    h.grow.style.width = (this.endless ? 100 : clamp(((P.size - lo) / (hi - lo)) * 100, 0, 100)).toFixed(1) + '%';
    const tierTxt = this.endless ? '无尽畅游' : `成长 ${this.tier} / ${L.tiers.length - 1}`;
    if (h.tier.textContent !== tierTxt) h.tier.textContent = tierTxt;
    const on = this.combo >= 2 && this.comboT > 0;
    h.combo.classList.toggle('on', on);
    if (on) {
      h.combo.firstChild.textContent = `连吃 ×${Math.min(this.combo, 8)}`;
      h.combo.querySelector('i').style.transform = `scaleX(${this.comboT / 2.6})`;
    }
    h.boost.style.width = (P.stamina * 100).toFixed(0) + '%';
  }

  // ---------------------------------------------------------------- input
  setPointer(x, y) {
    this.ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.pointerActive = true;
    this.cursor.style.left = x + 'px';
    this.cursor.style.top = y + 'px';
  }

  // ---------------------------------------------------------------- frame
  update(dtRaw) {
    const dt = dtRaw * this.timeScale;
    this.t += dtRaw;
    const P = this.player;
    const playing = this.state === 'play';
    const live = playing || this.state === 'dead' || this.state === 'complete' || this.state === 'title';

    if (this.state === 'complete') this.timeScale = damp(this.timeScale, 0.25, 3, dtRaw);
    else this.timeScale = 1;

    if (live) {
      // steering target from the pointer
      if (playing) {
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.plane, hit)) P.target.set(hit.x, hit.y);
        this.levelTime += dt;
      }
      if (P.alive) P.update(dt);
      this.cursor.style.opacity = playing && P.useKeys <= 0 ? 1 : 0;

      // schools steer as one
      for (const s of this.schools) {
        s.wander = (s.wander || 0) + (Math.random() - 0.5) * dt * 2;
        s.vel.y = damp(s.vel.y, Math.sin(this.t * 0.5 + s.pos.x) * 0.6 + Math.sin(s.wander) * 0.8, 1, dt);
        if (s.pos.y > WORLD.SURFACE - 3) s.vel.y -= dt * 4;
        if (s.pos.y < floorY(s.pos.x) + 3) s.vel.y += dt * 4;
        s.pos.addScaledVector(s.vel, dt);
      }
      this.schools = this.schools.filter((s) => s.members.length > 0);

      let danger = 0;
      const mouth = P.mouth();
      const { hw } = this.viewHalf();
      for (const c of this.creatures) {
        if (!c.alive) continue;
        if (c.dying > 0) {
          // swallowed: pulled into the mouth, shrinking
          c.dying += dt;
          const k = Math.min(1, c.dying / 0.16);
          c.pos.lerp(P.mouth(), k);
          c.model.group.position.set(c.pos.x, c.pos.y, c.z);
          c.model.group.scale.setScalar(Math.max(0.01, 1 - k));
          if (k >= 1) this.removeCreature(c);
          continue;
        }
        c.think(dt, this);
        c.animate(dt);
        // too far away: let it go
        if (Math.abs(c.pos.x - this.camPos.x) > hw * 1.7 + 6 + c.size * 2 || Math.abs(c.pos.x) > WORLD.W + 25) {
          this.removeCreature(c);
          continue;
        }
        if (!P.alive || !playing) continue;
        if (c instanceof Jelly) {
          if (P.invuln <= 0 && !this.god && c.touches(P.pos, P.radius * 0.8)) this.sting(c);
          continue;
        }
        const preyable = P.size * EDGE > c.size && !c.ai.never;
        if (preyable) {
          if (c.bodyDist(mouth) < P.size * 0.2) {
            if (c.sp.puffer && c.inflate > 0.5) {
              if (P.invuln <= 0 && !this.god) this.sting(c);
            } else this.eat(c);
          }
        } else if (c.sp.venom) {
          // too big to swallow: brushing against its spines stings
          if (P.invuln <= 0 && !this.god && c.bodyDist(P.pos) < P.radius * 0.6) this.sting(c);
        } else if (c.ai.predator && c.size * EDGE > P.size) {
          const d = c.pos.distanceTo(P.pos);
          if (c.chasing) danger = Math.max(danger, clamp(1 - d / (c.ai.aggro + 2), 0, 1));
          c.model.U.uDanger.value = damp(c.model.U.uDanger.value, c.chasing ? 0.3 : 0, 4, dt);
          if (P.invuln <= 0 && !this.god && P.bodyDist(c.mouth()) < c.size * 0.12) {
            this.playerEaten(c);
            break;
          }
        } else c.model.U.uDanger.value = 0;
      }
      this.creatures = this.creatures.filter((c) => c.alive);
      this.audio.danger(playing ? danger : 0, dtRaw);
      this.hud.danger.style.opacity = (playing ? Math.min(0.7, danger) : 0).toFixed(2);

      // pearls
      if (playing && P.alive)
        for (const cl of this.ocean.clams) {
          if (!cl.hasPearl || cl.open < 0.55) continue;
          const d = Math.hypot(mouth.x - cl.x, mouth.y - (cl.y + 0.2));
          if (d < 0.7 + P.size * 0.25) {
            cl.hasPearl = false;
            cl.regrow = 25;
            const chest = cl.kind === 'chest';
            const pts = (chest ? 400 : 300) * (this.levelIndex + 1);
            this.score += pts;
            this.pearls++;
            this.audio.pearl();
            this.fx.sparkle(cl.x, cl.y + 0.3, 0.8, 26, chest ? [3.0, 2.3, 0.8] : [2.6, 2.5, 3.0], 0.45);
            this.fx.popup(`${chest ? '金币' : '珍珠'} +${pts}`, cl.x, cl.y + 1.4, 'big');
          }
        }

      // scalding vents
      for (const h of this.ocean.hazards) {
        if (h.state === 'erupt' && Math.random() < dtRaw * 30) this.fx.bubble(h.x, h.y + 0.5, h.z, 1, 0.5, 4, 0.18);
        if (h.state === 'warn' && Math.random() < dtRaw * 12) this.fx.bubble(h.x, h.y + 0.2, h.z, 1, 0.3, 1, 0.1);
        if (!playing || !P.alive || h.k < 0.6 || P.invuln > 0 || this.god) continue;
        const top = h.y + 1 + 11 * h.k;
        if (Math.abs(P.pos.x - h.x) < 1.0 + P.radius * 0.6 && P.pos.y > h.y - P.radius && P.pos.y < top) this.sting({ id: 'vent', pos: new THREE.Vector2(h.x, P.pos.y - 2) });
      }

      // keep the sea stocked
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.state === 'title' ? 0.6 : 0.3;
        if (this.creatures.length < 70) this.spawn();
      }
      if (P.alive && playing) {
        // a trail of bubbles when dashing
        if (P.boosting && Math.random() < dt * 30) {
          const f = P.forward();
          this.fx.bubble(P.pos.x - f.x * P.size * 0.5, P.pos.y - f.y * P.size * 0.5, P.z, 1, 0.3 * P.size, 1.2, 0.08 + P.size * 0.02);
        }
        if (P.boosting && !this._wasBoost) this.audio.whoosh();
        this._wasBoost = P.boosting;
        if (Math.random() < dt * 0.6) this.fx.bubble(mouth.x, mouth.y, P.z, 1, 0.1, 0.4, 0.07);
      }
    }

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.state === 'dead') {
      this.deadT -= dtRaw;
      if (this.deadT <= 0) {
        if (this.lives > 0) this.respawn();
        else this.gameOver();
      }
    }
    // ambient bubbles from vents and clams
    for (const v of this.ocean.vents) if (Math.random() < dtRaw * 14) this.fx.bubble(v.x, v.y, v.z, 1, 0.5, 0.6, 0.14);
    for (const cl of this.ocean.clams) if (cl.open > 0.5 && Math.random() < dtRaw * 3) this.fx.bubble(cl.x, cl.y, 0.4, 1, 0.3, 0.4, 0.08);

    this.pipe.params.hurt = damp(this.pipe.params.hurt, 0, 1.5, dtRaw);
    this.pipe.params.ca = damp(this.pipe.params.ca, P.boost, 6, dtRaw);
    this.ocean.update(dtRaw);
    this.fx.update(dtRaw);
    this.updateCamera(dtRaw);
    if (this.state !== 'title') this.updateHUD();
  }

  updateCamera(dt) {
    const P = this.player;
    const cam = this.camera;
    let tx, ty;
    if (this.state === 'title') {
      tx = Math.sin(this.t * 0.04) * (WORLD.W - 25);
      ty = 1 + Math.sin(this.t * 0.07) * 3;
      this.dist = damp(this.dist, 21, 1, dt);
    } else {
      tx = P.pos.x + P.vel.x * 0.35;
      ty = P.pos.y + P.vel.y * 0.2;
      this.dist = damp(this.dist, 11 + P.size * 3, 1.2, dt);
    }
    const { hh, hw } = this.viewHalf();
    tx = clamp(tx, -WORLD.W + hw * 0.55, WORLD.W - hw * 0.55);
    ty = clamp(ty, WORLD.FLOOR + hh * 0.72, WORLD.SURFACE - hh * 0.55);
    this.camPos.x = damp(this.camPos.x, tx, 2.6, dt);
    this.camPos.y = damp(this.camPos.y, ty, 2.6, dt);
    const sh = this.fx.shake;
    const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    cam.position.set(this.camPos.x + sx, this.camPos.y + this.dist * 0.08 + sy, this.dist);
    this.camLook.set(this.camPos.x + sx * 0.5, this.camPos.y, 0);
    cam.lookAt(this.camLook);
    G.uFogStart.value = this.dist * 0.85;
  }
}

function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.style.width = src.style.width;
  c.style.height = src.style.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
