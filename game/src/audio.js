// audio.js — all sound is synthesized with WebAudio, no audio files.
//
// A tiny synth: short oscillator blips for game events, filtered noise for
// the fire breath, and simple two-note phrases for the horn, win and loss.
// Everything is guarded: if the browser has no AudioContext (or the user
// never interacted), every call is a silent no-op and the game plays on.

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.breathNodes = null;
    this.muted = false;
  }

  // Call once from a user gesture (click / key). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.ctx = null;
    }
  }

  // A short tone: frequency slides from `from` to `to` over `dur` seconds.
  blip(from, to, dur, type, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
      gain.gain.setValueAtTime(volume || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (err) { /* sound is decoration, never fatal */ }
  }

  // A burst of filtered noise, for breath, hits and rain.
  noise(dur, filterFreq, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // Deterministic noise: a tiny LCG, so even the audio buffer is seeded.
      let s = 123456789;
      for (let i = 0; i < len; i += 1) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        data[i] = s / 0x40000000 - 1;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
      src.stop(t + dur);
    } catch (err) { /* silent */ }
  }

  // Continuous breath loop while the dragon is firing.
  startBreath() {
    if (!this.ctx || this.muted || this.breathNodes) return;
    try {
      const len = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let s = 987654321;
      for (let i = 0; i < len; i += 1) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        data[i] = s / 0x40000000 - 1;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0;
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.08);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      this.breathNodes = { src, gain };
    } catch (err) { /* silent */ }
  }

  stopBreath() {
    if (!this.breathNodes) return;
    try {
      const { src, gain } = this.breathNodes;
      gain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.08);
      src.stop(this.ctx.currentTime + 0.12);
    } catch (err) { /* silent */ }
    this.breathNodes = null;
  }

  // ---- Game events (one small call each) ----

  shoot(kind) {
    if (kind === 'orb') this.blip(320, 140, 0.18, 'sawtooth', 0.08);
    else this.blip(900, 500, 0.08, 'square', 0.05);
  }

  sword() { this.noise(0.12, 2400, 0.18); this.blip(220, 90, 0.15, 'sawtooth', 0.12); }

  rain() { this.noise(0.35, 3000, 0.10); }

  fireball() { this.blip(520, 180, 0.22, 'sawtooth', 0.10); }

  dash() { this.noise(0.14, 1800, 0.12); }

  overheat() { this.blip(700, 120, 0.5, 'sawtooth', 0.16); }

  nestHit() { this.blip(160, 60, 0.25, 'square', 0.22); this.noise(0.15, 500, 0.18); }

  enemyDie() { this.blip(420, 90, 0.16, 'triangle', 0.14); }

  ember() { this.blip(880, 1320, 0.09, 'sine', 0.08); }

  pickup() { this.blip(523, 784, 0.12, 'sine', 0.14); this.blip(784, 1046, 0.14, 'sine', 0.12); }

  horn(wave) {
    this.blip(196, 196, 0.35, 'sawtooth', 0.14);
    setTimeout(() => this.blip(262, 262, 0.4, 'sawtooth', 0.14), 160);
    if (wave >= 8) setTimeout(() => this.blip(330, 330, 0.5, 'sawtooth', 0.16), 340);
  }

  boss() {
    this.blip(110, 55, 0.8, 'sawtooth', 0.2);
    this.noise(0.6, 400, 0.16);
  }

  bossPhase() { this.blip(440, 880, 0.4, 'square', 0.14); }

  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, n, 0.35, 'sine', 0.16), i * 150));
  }

  loss() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, n * 0.9, 0.4, 'triangle', 0.16), i * 180));
  }
}
