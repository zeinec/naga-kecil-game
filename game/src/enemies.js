// enemies.js — the four hunter types and the two-phase boss.
//
// Each enemy is a plain object the world owns; this file knows how each type
// looks in data (stats come from config.js) and how it behaves each step:
// where it walks, when it stops to attack, and what it shoots. The boss is
// the Dragon Slayer: a sword phase up close, then an arrow-rain phase once
// his health drops below half.

import { CONFIG } from './config.js';

let nextId = 1;

// Build one enemy of the given type at a spawn point. hpScale comes from the
// wave table; the boss also gets his phase bookkeeping here.
export function createEnemy(type, x, y, hpScale, rng) {
  const base = CONFIG.enemies[type];
  const enemy = {
    id: nextId,
    type,
    x,
    y,
    radius: base.radius,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * rng.range(0.92, 1.08),
    damage: base.damage,
    attackInterval: base.attackInterval,
    attackTimer: rng.range(0.3, 1.0),
    score: base.score,
    embers: base.embers,
    color: base.color,
    // Visual wobble so swarms do not march in lockstep.
    wobble: rng.angle(),
    wobbleSpeed: rng.range(1.5, 3.5),
    flash: 0,
    // Ranged types keep their distance instead of touching the nest.
    range: base.range || 0,
    // Boss state.
    phase: type === 'boss' ? 1 : 0,
    rainTimer: 0,
    bannerShown: false,
  };
  nextId += 1;
  return enemy;
}

// Distance from an enemy to the nest centre.
function distToNest(enemy, world) {
  return Math.hypot(world.nest.x - enemy.x, world.nest.y - enemy.y);
}

// One behaviour step. Returns nothing; it moves the enemy, fires projectiles
// through world.spawnProjectile, and damages the nest through world.hitNest.
export function updateEnemy(enemy, world, dt) {
  const nest = world.nest;
  const dx = nest.x - enemy.x;
  const dy = nest.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  enemy.wobble += dt * enemy.wobbleSpeed;

  if (enemy.type === 'boss') {
    updateBoss(enemy, world, dt, dist, nx, ny);
    return;
  }

  // Ranged hunters stop at their range and shoot; the rest walk into the
  // nest and chew on it.
  if (enemy.range > 0) {
    if (dist > enemy.range) {
      enemy.x += nx * enemy.speed * dt;
      enemy.y += ny * enemy.speed * dt;
    } else {
      enemy.attackTimer -= dt;
      if (enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.attackInterval;
        const kind = enemy.type === 'witch' ? 'orb' : 'arrow';
        world.spawnProjectile(enemy.x, enemy.y, nest.x, nest.y, kind);
        world.audio.shoot(kind);
      }
    }
    return;
  }

  if (dist > nest.radius + enemy.radius - 6) {
    // Walk toward the nest with a gentle sideways wobble.
    const wob = Math.sin(enemy.wobble) * 0.35;
    const px = -ny * wob;
    const py = nx * wob;
    enemy.x += (nx + px) * enemy.speed * dt;
    enemy.y += (ny + py) * enemy.speed * dt;
  } else {
    // At the nest: chew. Each bite shakes the screen and hurts the nest.
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = enemy.attackInterval;
      world.hitNest(enemy.damage, enemy.x, enemy.y);
    }
    // Thorns: a spiked nest bites back.
    if (world.nest.thornDps > 0) {
      enemy.hp -= world.nest.thornDps * dt;
    }
  }
}

// The Dragon Slayer. Phase 1: he charges in and swings his sword up close.
// Phase 2 (below half health): he backs off and calls down arrow rain.
function updateBoss(boss, world, dt, dist, nx, ny) {
  const nest = world.nest;
  if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.phase = 2;
    boss.rainTimer = 0.5;
    boss.attackTimer = 1.0;
    world.bossPhase = 2;
    world.shake = Math.max(world.shake, 12);
    world.audio.bossPhase();
  }

  if (boss.phase === 1) {
    if (dist > nest.radius + boss.radius - 4) {
      boss.x += nx * boss.speed * dt;
      boss.y += ny * boss.speed * dt;
    } else {
      boss.attackTimer -= dt;
      if (boss.attackTimer <= 0) {
        boss.attackTimer = boss.attackInterval;
        world.hitNest(boss.damage, boss.x, boss.y);
        world.audio.sword();
      }
    }
    return;
  }

  // Phase 2: keep some distance and rain arrows on the nest.
  const wantDist = 320;
  if (dist < wantDist - 40) {
    boss.x -= nx * boss.speed * 0.7 * dt;
    boss.y -= ny * boss.speed * 0.7 * dt;
  } else if (dist > wantDist + 40) {
    boss.x += nx * boss.speed * 0.7 * dt;
    boss.y += ny * boss.speed * 0.7 * dt;
  }
  boss.rainTimer -= dt;
  if (boss.rainTimer <= 0) {
    boss.rainTimer = CONFIG.projectiles.arrowRainInterval;
    world.spawnArrowRain();
    world.audio.rain();
  }
  // He still swings if the dragon lets him get close to the nest.
  if (dist <= nest.radius + boss.radius) {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.attackInterval;
      world.hitNest(boss.damage, boss.x, boss.y);
    }
  }
}
