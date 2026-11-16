// world.js — the world state of NAGA KECIL: dragon, nest, enemies, embers,
// waves, spawning, combat rules and scoring.
//
// One World owns one run. It knows nothing about the DOM or the canvas; the
// game loop feeds it an input snapshot each step and the renderer reads its
// public fields. The autopilot feeds it the same snapshots, so staged
// screenshots and tests play through the real rules.

import { CONFIG, TOTAL_WAVES } from './config.js';
import { Rng } from './random.js';
import { createEnemy, updateEnemy } from './enemies.js';

export class World {
  constructor(seed, audio) {
    this.audio = audio;
    this.rng = new Rng(seed);
    this.seed = seed;
    this.time = 0;
    this.reset();
  }

  reset() {
    this.rng = new Rng(this.seed);
    this.time = 0;
    this.wave = 0;
    this.waveState = 'idle'; // idle | spawning | fighting | cleared
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.embers = [];
    this.fireballs = [];
    this.score = 0;
    this.emberCount = 0;
    this.kills = 0;
    this.nest = {
      x: CONFIG.nest.x,
      y: CONFIG.nest.y,
      radius: CONFIG.nest.radius,
      hp: CONFIG.nest.maxHp,
      maxHp: CONFIG.nest.maxHp,
      thornDps: 0,
    };
    this.dragon = {
      x: CONFIG.nest.x,
      y: CONFIG.nest.y - 130,
      radius: CONFIG.dragon.radius,
      aim: -Math.PI / 2,
      speed: CONFIG.dragon.speed,
      heat: 0,
      overheated: false,
      dashTimer: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: 1,
      flameOn: false,
      flameFlicker: 0,
    };
    // Upgrade state.
    this.flameRange = CONFIG.dragon.flameRange;
    this.flameHalfAngle = CONFIG.dragon.flameHalfAngle;
    this.flameDps = CONFIG.dragon.flameDps;
    this.heatPerSecond = CONFIG.dragon.heatPerSecond;
    this.magnetRadius = CONFIG.ember.magnetRadius;
    this.emberValue = CONFIG.ember.value;
    this.fireballLevel = 0;
    this.fireballTimer = 0;
    this.upgradeChoices = [];
    this.bossPhase = 0;
    this.boss = null;
    this.shake = 0;
    this.waveClearTimer = 0;
    this.over = false;
    this.won = false;
    this.cave = this.makeCave();
  }

  // The cave decoration: rocks and stalactites placed once per run from the
  // seeded generator, so the backdrop is identical for a given seed.
  makeCave() {
    const rocks = [];
    const spikes = [];
    for (let i = 0; i < 46; i += 1) {
      rocks.push({
        x: this.rng.range(20, CONFIG.arenaWidth - 20),
        y: this.rng.range(20, CONFIG.arenaHeight - 20),
        r: this.rng.range(6, 26),
        shade: this.rng.range(0, 1),
      });
    }
    for (let i = 0; i < 14; i += 1) {
      spikes.push({
        x: this.rng.range(30, CONFIG.arenaWidth - 30),
        top: this.rng.float() < 0.5,
        len: this.rng.range(26, 64),
        w: this.rng.range(14, 30),
      });
    }
    return { rocks, spikes };
  }

  // ---- Waves ------------------------------------------------------------

  startWave(number) {
    this.wave = number;
    const def = CONFIG.waves[number - 1];
    const queue = [];
    const types = ['bat', 'knight', 'archer', 'witch', 'boss'];
    for (const type of types) {
      const count = def[type] || 0;
      for (let i = 0; i < count; i += 1) queue.push(type);
    }
    this.rng.shuffle(queue);
    this.spawnQueue = queue;
    this.hpScale = def.hpScale;
    this.spawnTimer = 0.4;
    this.waveState = 'spawning';
    this.boss = null;
    this.bossPhase = 0;
    this.audio.horn(number);
  }

  spawnOne() {
    const type = this.spawnQueue.shift();
    // Spawn just outside a random edge, never on top of the nest.
    const side = this.rng.int(0, 3);
    const m = CONFIG.spawnMargin;
    let x;
    let y;
    if (side === 0) { x = this.rng.range(0, CONFIG.arenaWidth); y = -m; }
    else if (side === 1) { x = CONFIG.arenaWidth + m; y = this.rng.range(0, CONFIG.arenaHeight); }
    else if (side === 2) { x = this.rng.range(0, CONFIG.arenaWidth); y = CONFIG.arenaHeight + m; }
    else { x = -m; y = this.rng.range(0, CONFIG.arenaHeight); }
    const enemy = createEnemy(type, x, y, this.hpScale, this.rng);
    this.enemies.push(enemy);
    if (type === 'boss') {
      this.boss = enemy;
      this.bossPhase = 1;
      this.audio.boss();
    }
  }

  // Roll 3 distinct upgrade cards for the between-wave choice.
  rollUpgrades() {
    const pool = CONFIG.upgrades.map((u) => u.id);
    this.rng.shuffle(pool);
    this.upgradeChoices = pool.slice(0, 3).map((id) => CONFIG.upgrades.find((u) => u.id === id));
  }

  applyUpgrade(id) {
    const d = this.dragon;
    if (id === 'wide') this.flameHalfAngle *= 1.45;
    else if (id === 'long') {
      this.flameRange += 70;
      this.heatPerSecond *= 0.7;
    } else if (id === 'fast') d.speed *= 1.25;
    else if (id === 'magnet') {
      this.magnetRadius *= 2.4;
      this.emberValue *= 2;
    } else if (id === 'repair') this.nest.hp = Math.min(this.nest.maxHp, this.nest.hp + 35);
    else if (id === 'fireball') this.fireballLevel += 1;
    else if (id === 'thorns') this.nest.thornDps = 26;
    this.audio.pickup();
  }

  // ---- Combat -----------------------------------------------------------

  hitNest(damage, x, y) {
    if (this.over) return;
    this.nest.hp = Math.max(0, this.nest.hp - damage);
    this.shake = Math.max(this.shake, CONFIG.shakeOnNestHit);
    this.audio.nestHit();
    if (this.nest.hp <= 0) {
      this.over = true;
      this.won = false;
      this.audio.loss();
    }
  }

  spawnProjectile(x, y, tx, ty, kind) {
    const speed = kind === 'orb' ? CONFIG.projectiles.orbSpeed : CONFIG.projectiles.arrowSpeed;
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.projectiles.push({
      x, y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      kind,
      radius: kind === 'orb' ? CONFIG.projectiles.orbRadius : 5,
      damage: kind === 'orb' ? CONFIG.enemies.witch.damage : CONFIG.enemies.archer.damage,
    });
  }

  // Boss phase 2: a volley of arrows rains down around the nest.
  spawnArrowRain() {
    const count = CONFIG.projectiles.arrowRainCount;
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng.angle();
      const r = this.rng.range(20, 150);
      const tx = this.nest.x + Math.cos(angle) * r;
      const ty = this.nest.y + Math.sin(angle) * r;
      this.projectiles.push({
        x: tx + this.rng.range(-60, 60),
        y: ty - 320,
        vx: 0,
        vy: 340,
        kind: 'rain',
        radius: 5,
        damage: 2,
        targetX: tx,
        targetY: ty,
      });
    }
  }

  // The flame cone: enemies inside the cone and range take damage.
  breatheFire(dt) {
    const d = this.dragon;
    const cosHalf = Math.cos(this.flameHalfAngle);
    for (const enemy of this.enemies) {
      const dx = enemy.x - d.x;
      const dy = enemy.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.flameRange + enemy.radius) continue;
      const dot = (dx * Math.cos(d.aim) + dy * Math.sin(d.aim)) / (dist || 1);
      if (dist < 40 || dot > cosHalf) {
        enemy.hp -= this.flameDps * dt;
        enemy.flash = 0.25;
      }
    }
  }

  killEnemy(enemy) {
    this.kills += 1;
    this.score += enemy.score;
    for (let i = 0; i < enemy.embers; i += 1) {
      const a = this.rng.angle();
      this.embers.push({
        x: enemy.x + Math.cos(a) * 12,
        y: enemy.y + Math.sin(a) * 12,
        vx: Math.cos(a) * this.rng.range(40, 120),
        vy: Math.sin(a) * this.rng.range(40, 120),
        value: this.emberValue,
        age: 0,
      });
    }
    this.audio.enemyDie();
  }

  // Fireballs (upgrade): launched on a timer at the nearest enemy.
  updateFireballs(dt) {
    if (this.fireballLevel <= 0) return;
    this.fireballTimer -= dt;
    if (this.fireballTimer > 0 || this.enemies.length === 0) return;
    this.fireballTimer = 1.6 - this.fireballLevel * 0.25;
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - this.dragon.x, enemy.y - this.dragon.y);
      if (dist < bestDist) { bestDist = dist; best = enemy; }
    }
    if (!best) return;
    const dx = best.x - this.dragon.x;
    const dy = best.y - this.dragon.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.fireballs.push({
      x: this.dragon.x, y: this.dragon.y,
      vx: (dx / dist) * 520, vy: (dy / dist) * 520,
      radius: 9, damage: 34 + this.fireballLevel * 16, age: 0,
    });
    this.audio.fireball();
  }

  // ---- Main step --------------------------------------------------------

  update(input, dt) {
    if (this.over) return;
    this.time += dt;
    this.shake = Math.max(0, this.shake - CONFIG.shakeDecay * dt);
    const d = this.dragon;

    // Movement.
    let mx = input.moveX;
    let my = input.moveY;
    const moving = mx !== 0 || my !== 0;
    if (d.dashTimer > 0) {
      d.dashTimer -= dt;
      d.x += d.dashX * CONFIG.dragon.dashSpeed * dt;
      d.y += d.dashY * CONFIG.dragon.dashSpeed * dt;
    } else {
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      d.x += mx * d.speed * dt;
      d.y += my * d.speed * dt;
    }
    d.dashCooldown = Math.max(0, d.dashCooldown - dt);
    if (input.dash && d.dashCooldown <= 0 && moving) {
      d.dashCooldown = CONFIG.dragon.dashCooldown;
      d.dashTimer = CONFIG.dragon.dashTime;
      d.dashX = mx;
      d.dashY = my;
      this.audio.dash();
    }
    // Keep the dragon inside the cave.
    d.x = Math.max(d.radius, Math.min(CONFIG.arenaWidth - d.radius, d.x));
    d.y = Math.max(d.radius, Math.min(CONFIG.arenaHeight - d.radius, d.y));

    // Aim follows the mouse (or the autopilot's chosen point).
    d.aim = Math.atan2(input.aimY - d.y, input.aimX - d.x);

    // Fire breath and heat.
    const wantFire = input.firing && !d.overheated;
    d.flameOn = wantFire;
    if (wantFire) {
      d.heat += this.heatPerSecond * dt;
      d.flameFlicker = this.rng.float();
      this.breatheFire(dt);
      if (d.heat >= 100) {
        d.heat = 100;
        d.overheated = true;
        d.flameOn = false;
        this.audio.overheat();
      }
    } else {
      d.heat -= CONFIG.dragon.coolPerSecond * dt;
      if (d.heat < 0) d.heat = 0;
      if (d.overheated && d.heat <= CONFIG.dragon.overheatLockUntil) {
        d.overheated = false;
      }
    }

    this.updateFireballs(dt);

    // Spawning.
    if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnOne();
        this.spawnTimer = CONFIG.spawnInterval;
        if (this.spawnQueue.length === 0) this.waveState = 'fighting';
      }
    }

    // Enemies.
    for (const enemy of this.enemies) updateEnemy(enemy, this, dt);
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i].hp <= 0) {
        this.killEnemy(this.enemies[i]);
        this.enemies.splice(i, 1);
      }
    }

    // Projectiles: fly, hit the nest, or expire off-screen.
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const distNest = Math.hypot(p.x - this.nest.x, p.y - this.nest.y);
      if (distNest < this.nest.radius + p.radius) {
        this.hitNest(p.damage, p.x, p.y);
        this.projectiles.splice(i, 1);
      } else if (p.x < -60 || p.x > CONFIG.arenaWidth + 60 || p.y < -380 || p.y > CONFIG.arenaHeight + 60) {
        this.projectiles.splice(i, 1);
      }
    }

    // Fireballs: fly and burst on the first enemy they touch.
    for (let i = this.fireballs.length - 1; i >= 0; i -= 1) {
      const f = this.fireballs[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.age += dt;
      let hit = f.age > 2;
      for (const enemy of this.enemies) {
        if (Math.hypot(enemy.x - f.x, enemy.y - f.y) < enemy.radius + f.radius) {
          enemy.hp -= f.damage;
          enemy.flash = 0.25;
          hit = true;
          break;
        }
      }
      if (hit) this.fireballs.splice(i, 1);
    }

    // Embers: scatter, then fly to the dragon and score.
    for (let i = this.embers.length - 1; i >= 0; i -= 1) {
      const e = this.embers[i];
      e.age += dt;
      const dx = d.x - e.x;
      const dy = d.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < this.magnetRadius || e.age > 0.6) {
        e.x += (dx / dist) * CONFIG.ember.flySpeed * dt;
        e.y += (dy / dist) * CONFIG.ember.flySpeed * dt;
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.94;
        e.vy *= 0.94;
      }
      if (dist < CONFIG.ember.collectRadius) {
        this.score += e.value;
        this.emberCount += 1;
        this.audio.ember();
        this.embers.splice(i, 1);
      }
    }

    // Wave cleared?
    if ((this.waveState === 'fighting' || this.waveState === 'spawning')
      && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveState = 'cleared';
      this.waveClearTimer = 0;
      this.score += 100 * this.wave;
      // Clearing a wave steadies the nest a little: +8 HP, never over max.
      this.nest.hp = Math.min(this.nest.maxHp, this.nest.hp + 8);
      if (this.wave >= TOTAL_WAVES) {
        this.over = true;
        this.won = true;
        this.audio.win();
      } else {
        this.rollUpgrades();
      }
    }
  }
}
