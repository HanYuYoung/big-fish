import * as THREE from 'three';
import { WORLD } from '../core/globals.js';
import { clamp, damp } from '../core/rng.js';
import { FishModel } from '../fish/model.js';
import { JellyModel } from '../fish/jelly.js';
import { SPECIES, maxHalf } from '../fish/species.js';
import { floorY } from '../world/ocean.js';

export const EDGE = 0.92; // you can eat anything shorter than 92% of you

const YAW_R = -0.14, YAW_L = -Math.PI + 0.14;

// ---------------------------------------------------------------------------
// Shared body: position, velocity, facing and the swim animation.
// ---------------------------------------------------------------------------
export class Swimmer {
  constructor(id, size) {
    this.id = id;
    this.sp = SPECIES[id] || null;
    this.size = size;
    this.pos = new THREE.Vector2();
    this.vel = new THREE.Vector2();
    this.z = 0;
    this.facing = 1;
    this.yaw = YAW_R;
    this.yawVel = 0;
    this.pitch = 0;
    this.alive = true;
    this.flash = 0;
    this.chomp = 0;
    this.boost = 0;
    this.halfH = this.sp ? maxHalf(this.sp) * 0.85 : 0.3;
  }
  get radius() {
    return this.halfH * this.size;
  }
  // world-space mouth position and the body axis (nose -> tail root)
  forward(out = new THREE.Vector2()) {
    // the model's nose projected onto the play plane (shorter mid-turn, when it faces us)
    return out.set(Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch));
  }
  mouth(out = new THREE.Vector2()) {
    const f = this.forward();
    return out.copy(this.pos).addScaledVector(f, this.size * 0.47);
  }
  // distance from a point to this fish's body (a capsule along its axis)
  bodyDist(p) {
    const f = this.forward();
    const a = this.pos.clone().addScaledVector(f, this.size * 0.4);
    const b = this.pos.clone().addScaledVector(f, -this.size * 0.42);
    const ab = b.clone().sub(a);
    const t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return a.addScaledVector(ab, t).distanceTo(p) - this.radius;
  }
  keepInWater(desired, margin = 0.6) {
    const top = WORLD.SURFACE - margin - this.radius;
    const bot = floorY(this.pos.x, 0) + margin + this.radius;
    if (this.pos.y > top - 1.5) desired.y -= (this.pos.y - (top - 1.5)) * 2.5;
    if (this.pos.y < bot + 1.5) desired.y += (bot + 1.5 - this.pos.y) * 2.5;
  }
  integrate(dt, desired, agility) {
    this.vel.x = damp(this.vel.x, desired.x, agility, dt);
    this.vel.y = damp(this.vel.y, desired.y, agility, dt);
    this.pos.addScaledVector(this.vel, dt);
    const top = WORLD.SURFACE - 0.35 - this.radius * 0.6;
    const bot = floorY(this.pos.x, 0) + 0.25 + this.radius * 0.6;
    if (this.pos.y > top) {
      this.pos.y = top;
      this.vel.y = Math.min(this.vel.y, 0);
    }
    if (this.pos.y < bot) {
      this.pos.y = bot;
      this.vel.y = Math.max(this.vel.y, 0);
    }
  }
  animate(dt) {
    const m = this.model;
    if (!m) return;
    // face the way we swim, turning through a three-quarter view towards the camera
    if (this.vel.x > 0.25) this.facing = 1;
    else if (this.vel.x < -0.25) this.facing = -1;
    const target = this.facing > 0 ? YAW_R : YAW_L;
    const turnRate = 7 / Math.sqrt(Math.max(this.size, 0.4));
    const prev = this.yaw;
    this.yaw = damp(this.yaw, target, turnRate, dt);
    this.yawVel = damp(this.yawVel, (this.yaw - prev) / Math.max(dt, 1e-4), 10, dt);
    const sp = Math.hypot(this.vel.x, this.vel.y);
    const pt = clamp(Math.atan2(this.vel.y, Math.abs(this.vel.x) + 0.6), -0.7, 0.7);
    this.pitch = damp(this.pitch, pt, 5, dt);
    m.group.position.set(this.pos.x, this.pos.y, this.z);
    m.group.rotation.set(-this.yawVel * 0.04, this.yaw, this.pitch, 'YZX');
    if (m.U.uPhase) {
      const rel = sp / Math.max(this.size, 0.3);
      m.U.uPhase.value += dt * (4.5 + rel * 5.5 + this.boost * 6);
      m.U.uAmp.value = damp(m.U.uAmp.value, (0.045 + Math.min(0.07, rel * 0.02) + this.boost * 0.03) * (this.sp?.wave?.amp ?? 1), 4, dt);
      m.U.uBend.value = damp(m.U.uBend.value, clamp(-this.yawVel * 0.035 * this.facing, -0.15, 0.15), 8, dt);
      // the angler always hangs its jaw a little open
      m.U.uChomp.value = Math.max(this.chomp, this.sp?.lure ? 0.45 : 0);
      m.U.uFlap.value = 0.6 + Math.min(1, rel);
    }
    this.chomp = Math.max(0, this.chomp - dt * 5);
    this.flash = Math.max(0, this.flash - dt * 4);
    m.setFlash(this.flash);
  }
}

// ---------------------------------------------------------------------------
// Fish that live in the sea
// ---------------------------------------------------------------------------
export class Fish extends Swimmer {
  constructor(id, size, rng) {
    super(id, size);
    this.rng = rng;
    this.ai = this.sp.ai;
    this.model = new FishModel(id);
    this.model.setSize(size);
    this.wander = rng.range(0, Math.PI * 2);
    this.cruiseK = rng.range(0.8, 1.2);
    this.energy = 2.4;
    this.rest = 0;
    this.burstT = 0;
    this.inflate = 0;
    this.inflateT = 0;
    this.school = null;
    this.offset = new THREE.Vector2();
    this.home = null;
    this.panic = 0;
    this.fleeT = 0;
    this.dying = 0;
    this.z = rng.range(-0.45, 0.45);
    this.age = 0;
  }
  get edibleBy() {
    return this.sp.ai.never ? Infinity : this.size / EDGE;
  }
  think(dt, game) {
    const P = game.player;
    const ai = this.ai;
    this.age += dt;
    const d = new THREE.Vector2();
    // wander: a slow drifting heading, mostly horizontal
    this.wander += (Math.sin(this.age * 0.7 + this.cruiseK * 10) * 0.6 + this.rng.range(-1, 1) * 0.4) * dt;
    let cruise = ai.cruise * this.cruiseK;
    if (this.inflate > 0.3) cruise *= 0.35;
    d.set(Math.cos(this.wander), Math.sin(this.wander) * 0.35).multiplyScalar(cruise);
    if (this.dir) d.x = Math.abs(d.x) * this.dir + d.x * 0.15;

    // schooling: follow the shoal's leader point with a personal offset
    if (this.school) {
      const s = this.school;
      const tgt = s.pos.clone().add(this.offset);
      const to = tgt.sub(this.pos);
      d.copy(s.vel).addScaledVector(to, 1.6);
    }
    // clownfish stay close to their anemone
    if (this.home) {
      const to = this.home.clone().sub(this.pos);
      if (to.length() > 3) d.addScaledVector(to.normalize(), cruise * 1.2);
      else d.multiplyScalar(0.5).add(new THREE.Vector2(Math.sin(this.age * 1.3) * 0.8, Math.cos(this.age * 1.1) * 0.4));
    }

    const dist = this.pos.distanceTo(P.pos);
    const playerBigger = P.alive && P.size * EDGE > this.size && !ai.never;
    const playerPrey = P.alive && !P.invuln && ai.predator && this.size * EDGE > P.size;
    this.chasing = false;
    // flee from a bigger player
    const fleeR = 2 + P.size * 1.1 + 1.6 * (ai.skittish || 1);
    if (playerBigger && dist < fleeR && this.dying === 0) {
      const away = this.pos.clone().sub(P.pos).normalize();
      // dive for cover rather than straight out to sea
      away.y += (this.pos.y > P.pos.y ? 0.4 : -0.4);
      this.panic = Math.min(1, this.panic + dt * 3);
      this.fleeT += dt;
      const k = 1 - dist / fleeR;
      // a startled dash that soon tires
      const tired = 1 - Math.min(0.45, this.fleeT * 0.16);
      d.lerp(away.normalize().multiplyScalar(ai.flee * 0.8 * tired * (0.5 + 0.5 * k)), 0.8);
    } else {
      this.panic = Math.max(0, this.panic - dt);
      this.fleeT = Math.max(0, this.fleeT - dt * 0.5);
    }

    // predators hunt the player in bursts, then tire. Only one hunts at a time,
    // and only once it is on screen, so nothing ambushes you from out of view.
    const { hw, hh } = game.viewHalf();
    const inView = Math.abs(this.pos.x - game.camPos.x) < hw - 0.5 && Math.abs(this.pos.y - game.camPos.y) < hh;
    const free = !game.hunter || game.hunter === this || !game.hunter.alive || !game.hunter.chasing;
    if (playerPrey && dist < ai.aggro + P.size && this.rest <= 0 && free && (inView || game.hunter === this)) {
      this.chasing = true;
      game.hunter = this;
      this.energy -= dt;
      const lead = P.pos.clone().addScaledVector(P.vel, 0.35).sub(this.pos).normalize();
      let sp = ai.chase;
      if (ai.burst) {
        this.burstT += dt;
        sp *= 0.55 + 0.75 * Math.max(0, Math.sin(this.burstT * 2.2));
      }
      d.copy(lead.multiplyScalar(sp));
      if (this.energy <= 0) {
        this.rest = 4 + this.rng.next() * 2.5;
        this.energy = 2 + this.rng.next() * 1;
        this.chasing = false;
        if (game.hunter === this) game.hunter = null;
      }
    } else {
      this.rest -= dt;
      this.energy = Math.min(3.5, this.energy + dt * 0.5);
    }

    // pufferfish blow up when something big comes close
    if (this.sp.puffer) {
      if (P.alive && dist < 3 + P.size && P.size > this.size * 0.75) this.inflateT = 3.5;
      this.inflateT -= dt;
      this.inflate = damp(this.inflate, this.inflateT > 0 ? 1 : 0, this.inflateT > 0 ? 9 : 1.5, dt);
      this.model.setInflate(this.inflate);
    }

    this.keepInWater(d);
    // stay inside the depth band this species likes
    const band = ai.depth || [0, 1];
    const hiY = WORLD.SURFACE - band[0] * (WORLD.SURFACE - WORLD.FLOOR);
    const loY = WORLD.SURFACE - band[1] * (WORLD.SURFACE - WORLD.FLOOR);
    if (!this.chasing && this.panic < 0.3) {
      if (this.pos.y > hiY) d.y -= 1.2;
      if (this.pos.y < loY) d.y += 1.2;
    }
    this.boost = this.chasing || this.panic > 0.5 ? 1 : 0;
    this.integrate(dt, d, this.chasing || this.panic > 0 ? 3.2 : 1.6);
  }
}

// ---------------------------------------------------------------------------
export class Jelly extends Swimmer {
  constructor(rng, size, blue) {
    super('jelly', size);
    this.halfH = 0.5;
    this.model = new JellyModel(blue);
    this.model.setSize(size);
    this.model.U.uPhase.value = rng.range(0, 10);
    this.t = rng.range(0, 10);
    this.rng = rng;
    this.drift = rng.range(-0.5, 0.5);
    this.z = rng.range(-0.6, 0.3);
  }
  get radius() {
    return 0.45 * this.size;
  }
  get edibleBy() {
    return Infinity;
  }
  // the stinging zone: bell plus the curtain of tentacles beneath it
  touches(p, r) {
    const dx = Math.abs(p.x - this.pos.x), dy = p.y - this.pos.y;
    if (Math.hypot(dx, dy - 0.1 * this.size) < 0.5 * this.size + r) return true;
    return dx < 0.42 * this.size + r * 0.5 && dy < 0 && dy > -1.6 * this.size - r;
  }
  think(dt) {
    this.t += dt;
    const cycle = (this.t * 0.55) % 1;
    const pulse = cycle < 0.25 ? Math.sin((cycle / 0.25) * Math.PI) : 0;
    this.model.U.uPulse.value = pulse;
    this.model.U.uPhase.value += dt;
    // each squeeze pushes it upward; between beats it sinks
    this.vel.y += (pulse * 2.6 - 0.45) * dt;
    this.vel.y *= 1 - dt * 0.9;
    this.vel.x = this.drift * 0.6 + Math.sin(this.t * 0.2) * 0.2;
    const top = WORLD.SURFACE - 2 - this.size;
    if (this.pos.y > top) this.vel.y -= dt * 2;
    if (this.pos.y < floorY(this.pos.x) + 2 + this.size * 1.6) this.vel.y += dt * 2;
    this.pos.addScaledVector(this.vel, dt);
    this.model.U.uDrift.value.set(this.vel.x, this.vel.y);
    this.model.group.position.set(this.pos.x, this.pos.y, this.z);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.model.setFlash(this.flash);
  }
  animate() {}
}

// ---------------------------------------------------------------------------
export class Player extends Swimmer {
  constructor() {
    super('hero', 1);
    this.model = new FishModel('hero');
    this.model.U.uRimCol.value.set(0.35, 0.45, 0.35);
    this.mass = 1;
    this.stamina = 1;
    this.invuln = 0;
    this.stun = 0;
    this.z = 0.7;
    this.target = new THREE.Vector2();
    this.keys = new THREE.Vector2();
    this.useKeys = 0;
    this.boosting = false;
    this.wantBoost = false;
  }
  setSize(s) {
    this.size = s;
    this.mass = s * s;
    this.model.setSize(s);
  }
  grow(m) {
    this.mass += m;
    this.size = Math.sqrt(this.mass);
  }
  shrink(frac, min) {
    this.mass = Math.max(min * min, this.mass * (1 - frac));
    this.size = Math.sqrt(this.mass);
  }
  update(dt) {
    const base = 6.2 + this.size * 0.55;
    const canBoost = this.stamina > 0.05 && this.stun <= 0;
    this.boosting = this.wantBoost && canBoost && this.vel.length() > 1;
    if (this.boosting) this.stamina = Math.max(0, this.stamina - dt * 0.42);
    else this.stamina = Math.min(1, this.stamina + dt * (this.wantBoost ? 0.08 : 0.2));
    this.boost = damp(this.boost, this.boosting ? 1 : 0, 6, dt);
    const maxV = base * (1 + this.boost * 0.85);
    const d = new THREE.Vector2();
    if (this.stun > 0) {
      this.stun -= dt;
    } else if (this.useKeys > 0) {
      d.copy(this.keys);
      if (d.lengthSq() > 0) d.normalize().multiplyScalar(maxV);
    } else {
      d.copy(this.target).sub(this.pos);
      const L = d.length();
      // ease in close to the cursor so the fish settles instead of circling
      const want = Math.min(maxV, L * 2.6);
      if (L > 0.05) d.multiplyScalar(want / L);
      else d.set(0, 0);
    }
    this.useKeys = Math.max(0, this.useKeys - dt);
    this.integrate(dt, d, this.stun > 0 ? 0.6 : 4.5 / Math.pow(this.size, 0.25));
    this.pos.x = clamp(this.pos.x, -WORLD.W + 1, WORLD.W - 1);
    this.invuln = Math.max(0, this.invuln - dt);
    this.animate(dt);
    // a soft shimmer while invulnerable (never disappears)
    this.model.group.visible = this.alive;
    if (this.invuln > 0) this.model.setFlash(Math.max(this.flash, 0.12 + 0.1 * Math.sin(this.invuln * 14)));
  }
}

export function makeCreature(id, size, rng) {
  if (id === 'jelly') return new Jelly(rng, size, rng.next() < 0.5);
  return new Fish(id, size, rng);
}
