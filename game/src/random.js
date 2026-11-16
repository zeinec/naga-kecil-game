// random.js — a seeded random number source for NAGA KECIL.
//
// The whole game runs on this, never on the unseeded built-in generator, so
// a run with a given seed plays out exactly the same way every time.
// screenshot stages and the autopilot reproducible: same seed, same waves,
// same spawns, same upgrade draws, same screenshots.

// Mulberry32: a small, fast, well-behaved seeded generator.
export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A tiny helper class so callers can ask for ranges and picks by name.
export class Rng {
  constructor(seed) {
    this.next = makeRng(seed);
  }

  // Float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Pick one element of an array.
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  // Angle in [0, 2π).
  angle() {
    return this.next() * Math.PI * 2;
  }

  // Fisher-Yates shuffle, in place, using this generator.
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }
}
