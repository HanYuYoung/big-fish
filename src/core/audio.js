// Everything you hear is synthesised: an underwater ambience, generative music in
// a pentatonic key per sea, and the sound effects.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const KEYS = {
  reef: { root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], bpm: 88, bright: 1 },
  kelp: { root: 62, scale: [0, 2, 3, 7, 9], chords: [[0, 3, 7], [10, 2, 5], [5, 9, 0], [7, 10, 2]], bpm: 78, bright: 0.8 },
  wreck: { root: 59, scale: [0, 2, 3, 7, 8], chords: [[0, 3, 7], [8, 0, 3], [3, 7, 10], [7, 11, 2]], bpm: 72, bright: 0.7 },
  ice: { root: 64, scale: [0, 2, 4, 7, 11], chords: [[0, 4, 7], [9, 0, 4], [4, 7, 11], [5, 9, 0]], bpm: 66, bright: 1.1 },
  deep: { root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [8, 0, 3], [5, 8, 0], [7, 10, 2]], bpm: 62, bright: 0.45 },
  lava: { root: 52, scale: [0, 1, 4, 5, 7], chords: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [10, 1, 5]], bpm: 84, bright: 0.55 },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.key = KEYS.reef;
    this.step = 0;
    this.nextT = 0;
    this.heart = 0;
    this.heartT = 0;
  }
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, ctx.currentTime, 0.8);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    this.master.connect(comp).connect(ctx.destination);
    // everything is heard through water: a gentle low-pass on the whole mix
    this.water = ctx.createBiquadFilter();
    this.water.type = 'lowpass';
    this.water.frequency.value = 5200;
    this.water.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.75;
    this.sfx.connect(this.water);
    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.water);
    // long watery reverb
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb.buffer = ir;
    const vg = ctx.createGain();
    vg.gain.value = 0.5;
    this.verb.connect(vg).connect(this.water);
    // noise for bubbles, whooshes and the ambient bed
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3 + (Math.random() * 2 - 1) * 0.08;
    }
    this.noise = buf;
    const bed = ctx.createBufferSource();
    bed.buffer = buf;
    bed.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 320;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(bf.frequency);
    lfo.start();
    this.bedGain = ctx.createGain();
    this.bedGain.gain.value = 0.32;
    bed.connect(bf).connect(this.bedGain).connect(this.water);
    bed.start();
    this.nextT = ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 90);
  }
  setKey(k) {
    this.key = KEYS[k] || KEYS.reef;
  }
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  // ----- instruments -----
  tone(f, t, dur, { type = 'sine', gain = 0.2, attack = 0.005, verb = 0.3, dest = this.sfx, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    if (verb) {
      const s = ctx.createGain();
      s.gain.value = verb;
      g.connect(s).connect(this.verb);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  pluck(n, t, gain = 0.12) {
    // a soft marimba: fundamental plus a quick fourth harmonic
    const f = midi(n);
    this.tone(f, t, 1.4, { gain, dest: this.music, verb: 0.45 });
    this.tone(f * 4, t, 0.18, { gain: gain * 0.25, dest: this.music, verb: 0.2 });
  }
  pad(notes, t, dur) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + 900 * this.key.bright;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    g.connect(this.music);
    const s = ctx.createGain();
    s.gain.value = 0.6;
    g.connect(s).connect(this.verb);
    for (const n of notes)
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
  }
  schedule() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const K = this.key;
    const beat = 60 / K.bpm / 2; // eighth notes
    while (this.nextT < ctx.currentTime + 0.25) {
      const t = this.nextT, s = this.step;
      const bar = Math.floor(s / 8) % 4;
      const chord = K.chords[bar];
      if (s % 32 === 0 || s % 8 === 0) {
        if (s % 16 === 0) this.pad(chord.map((c) => K.root - 12 + c), t, beat * 16);
        this.tone(midi(K.root - 24 + chord[0]), t, beat * 6, { gain: 0.07, dest: this.music, verb: 0.2, attack: 0.03 });
      }
      // a sparse melody that drifts over the scale
      if (Math.random() < (s % 2 ? 0.18 : 0.42) * (0.6 + 0.4 * K.bright)) {
        const deg = K.scale[Math.floor(Math.random() * K.scale.length)];
        const oct = Math.random() < 0.3 ? 12 : 0;
        this.pluck(K.root + deg + oct, t, 0.06 + Math.random() * 0.05);
      }
      this.nextT += beat;
      this.step++;
    }
  }

  // ----- effects -----
  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  gulp(size = 1, combo = 1) {
    if (!this.ctx) return;
    const t = this.now();
    const f0 = 520 * Math.pow(1.06, Math.min(combo, 8)) / Math.sqrt(size);
    const o = this.tone(f0, t, 0.22, { type: 'sine', gain: 0.32, verb: 0.15 });
    o.frequency.exponentialRampToValueAtTime(f0 * 0.38, t + 0.16);
    this.blub(t + 0.04, 0.12);
    if (combo > 1) this.tone(midi(this.key.root + 12 + this.key.scale[Math.min(combo - 2, 4)] + (combo > 6 ? 12 : 0)), t + 0.06, 0.4, { gain: 0.08, verb: 0.4 });
  }
  blub(t = this.now(), gain = 0.08) {
    if (!this.ctx) return;
    const f = 300 + Math.random() * 500;
    const o = this.tone(f, t, 0.09, { gain, verb: 0.1 });
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.08);
  }
  grow() {
    if (!this.ctx) return;
    const t = this.now(), K = this.key;
    [0, 2, 4, 5, 7].forEach((k, i) => this.tone(midi(K.root + 12 + K.scale[k % 5] + (k > 4 ? 12 : 0)), t + i * 0.07, 0.6, { type: 'triangle', gain: 0.12, verb: 0.5 }));
  }
  pearl() {
    if (!this.ctx) return;
    const t = this.now();
    for (const [m, g] of [[1, 0.14], [2.76, 0.06], [5.4, 0.03]]) this.tone(1320 * m, t, 1.6, { gain: g, verb: 0.6 });
  }
  sting() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.tone(900, t, 0.35, { type: 'square', gain: 0.07, verb: 0.2 });
    o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    this.noiseHit(t, 0.25, 2200, 0.2);
  }
  hurt() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.tone(220, t, 1.1, { type: 'triangle', gain: 0.25, verb: 0.5 });
    o.frequency.exponentialRampToValueAtTime(55, t + 1.0);
    this.noiseHit(t, 0.6, 700, 0.35);
    for (let i = 0; i < 6; i++) this.blub(t + 0.1 + i * 0.07, 0.06);
  }
  noiseHit(t, dur, freq, gain) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now();
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random());
    s.stop(t + 0.7);
  }
  levelUp() {
    if (!this.ctx) return;
    const t = this.now(), K = this.key;
    const seq = [0, 1, 2, 3, 4, 5, 6, 7];
    seq.forEach((k, i) => this.tone(midi(K.root + K.scale[k % 5] + 12 * Math.floor(k / 5)), t + i * 0.09, 1.2, { type: 'triangle', gain: 0.12, verb: 0.6 }));
    this.tone(midi(K.root + 24), t + 0.8, 2.5, { gain: 0.1, verb: 0.8 });
  }
  gameOver() {
    if (!this.ctx) return;
    const t = this.now(), K = this.key;
    [4, 3, 2, 0].forEach((k, i) => this.tone(midi(K.root + K.scale[k]), t + i * 0.32, 1.4, { type: 'triangle', gain: 0.12, verb: 0.6 }));
  }
  click() {
    if (!this.ctx) return;
    this.tone(880, this.now(), 0.08, { gain: 0.06, verb: 0.1 });
  }
  // predator close: a low double heartbeat whose rate follows the danger
  danger(k, dt) {
    if (!this.ctx || this.muted) return;
    this.heart = k;
    if (k < 0.05) return;
    this.heartT -= dt;
    if (this.heartT <= 0) {
      const t = this.now();
      for (const off of [0, 0.16]) {
        const o = this.tone(70, t + off, 0.25, { gain: 0.22 * k, verb: 0, attack: 0.01 });
        o.frequency.exponentialRampToValueAtTime(40, t + off + 0.2);
      }
      this.heartT = 1.1 - 0.55 * k;
    }
  }
}
