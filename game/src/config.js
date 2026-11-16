// config.js — every tuning number for NAGA KECIL lives here, in one place.
// Nothing else in the game hard-codes a speed, a hit-point total or a damage
// value: if the game feels too hard or too easy, change it here and the whole
// game (including the autopilot) follows.

export const CONFIG = {
  // Arena: the logical canvas size. The renderer scales this to the window.
  arenaWidth: 1280,
  arenaHeight: 720,

  // The nest sits in the middle of the cave. Losing it loses the run.
  nest: {
    x: 640,
    y: 360,
    radius: 56,
    maxHp: 100,
    // Thorns damage (per second) dealt to an enemy chewing on the nest.
    thornDps: 0,
  },

  // The baby dragon.
  dragon: {
    radius: 22,
    speed: 260,
    // Fire breath.
    flameRange: 230,
    flameHalfAngle: 0.38,
    flameDps: 95,
    // Heat: 0..100. Firing builds it, resting cools it.
    heatPerSecond: 34,
    coolPerSecond: 40,
    overheatLockUntil: 25,
    // Dash: a short burst of speed, then a cooldown.
    dashSpeed: 780,
    dashTime: 0.16,
    dashCooldown: 1.1,
  },

  // Enemy base stats, per type. Waves scale these a little (see waves below).
  enemies: {
    bat: {
      hp: 18, speed: 150, radius: 15, damage: 3, attackInterval: 0.9,
      score: 10, embers: 1, color: '#8b5cf6',
    },
    knight: {
      hp: 95, speed: 62, radius: 24, damage: 8, attackInterval: 1.4,
      score: 30, embers: 3, color: '#94a3b8',
    },
    archer: {
      hp: 38, speed: 88, radius: 17, damage: 2, attackInterval: 2.2,
      score: 25, embers: 2, color: '#4ade80', range: 300,
    },
    witch: {
      hp: 55, speed: 70, radius: 19, damage: 5, attackInterval: 2.8,
      score: 40, embers: 3, color: '#c084fc', range: 340,
    },
    boss: {
      hp: 600, speed: 78, radius: 42, damage: 16, attackInterval: 1.2,
      score: 500, embers: 12, color: '#ef4444',
    },
  },

  // Enemy projectiles (archer arrows, witch orbs, boss arrow rain).
  projectiles: {
    arrowSpeed: 320,
    orbSpeed: 210,
    orbRadius: 10,
    arrowRainCount: 9,
    arrowRainInterval: 2.6,
  },

  // Waves 1..8. counts are per type; hpScale multiplies enemy HP each wave.
  waves: [
    { bat: 6, knight: 0, archer: 0, witch: 0, hpScale: 1.00 },
    { bat: 9, knight: 2, archer: 0, witch: 0, hpScale: 1.05 },
    { bat: 10, knight: 3, archer: 3, witch: 0, hpScale: 1.10 },
    { bat: 13, knight: 4, archer: 4, witch: 0, hpScale: 1.16 },
    { bat: 14, knight: 5, archer: 5, witch: 3, hpScale: 1.22 },
    { bat: 14, knight: 5, archer: 6, witch: 4, hpScale: 1.28 },
    { bat: 15, knight: 6, archer: 6, witch: 4, hpScale: 1.35 },
    { bat: 8, knight: 3, archer: 3, witch: 2, boss: 1, hpScale: 1.35 },
  ],

  // Spawning: one enemy every spawnInterval seconds while the queue lasts.
  spawnInterval: 0.85,
  spawnMargin: 40,

  // Embers: what a dead enemy drops. They drift to the dragon, then score.
  ember: {
    value: 10,
    flySpeed: 420,
    collectRadius: 30,
    magnetRadius: 90,
  },

  // Between-wave upgrade cards. Each entry: id, title, description, apply().
  // The apply functions live in world.js (they touch world state); the list
  // of ids and their display text lives here.
  upgrades: [
    { id: 'wide', title: 'Api Lebar', desc: 'Kerucut api 45% lebih lebar.' },
    { id: 'long', title: 'Napas Panjang', desc: 'Jangkauan api +70 dan panas naik lebih lambat.' },
    { id: 'fast', title: 'Sayap Cepat', desc: 'Gerakan 25% lebih cepat.' },
    { id: 'magnet', title: 'Magnet Ember', desc: 'Ember tertarik dari jauh dan bernilai ganda.' },
    { id: 'repair', title: 'Perbaiki Sarang', desc: 'Pulihkan 35 HP sarang.' },
    { id: 'fireball', title: 'Bola Api', desc: 'Tembakan bola api berkala ke musuh terdekat.' },
    { id: 'thorns', title: 'Duri Sarang', desc: 'Sarang melukai musuh yang menyerangnya.' },
  ],

  // Screen shake when the nest is hit.
  shakeOnNestHit: 7,
  shakeDecay: 26,
};

// How many waves a run has. Derived, so the wave table above is the source.
export const TOTAL_WAVES = CONFIG.waves.length;
