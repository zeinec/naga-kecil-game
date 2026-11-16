// shots.js — screenshot staging and the deterministic autopilot.
//
// The autopilot plays NAGA KECIL through the same simulation rules a human
// uses: it builds one input snapshot per step from the world state (move,
// aim, fire, dash) and feeds it to world.update. It never touches world
// internals directly, so a staged win or loss is a real win or loss.
// The capture driver uses the ?shot= modes, which run the autopilot (or an
// idle dragon, for the loss) synchronously, freeze the frame, and set the
// ready flag the driver waits for.

import { CONFIG, TOTAL_WAVES } from './config.js';

// ---- Autopilot ----------------------------------------------------------

// Pick the upgrade the autopilot wants most, given the world.
export function autopilotPickUpgrade(world) {
  const choices = world.upgradeChoices;
  const nestFrac = world.nest.hp / world.nest.maxHp;
  const priority = ['wide', 'fireball', 'long', 'fast', 'thorns', 'magnet', 'repair'];
  if (nestFrac < 0.45) priority.unshift('repair');
  for (const id of priority) {
    const found = choices.find((c) => c.id === id);
    if (found) return found.id;
  }
  return choices[0].id;
}

// One input snapshot for this step. The dragon chases the nearest enemy,
// keeps about flame range away, and fires whenever the enemy is inside the
// cone. When nothing is alive it drifts back toward the nest.
export function autopilotSnapshot(world) {
  const d = world.dragon;
  const snap = {
    moveX: 0, moveY: 0,
    aimX: d.x, aimY: d.y - 100,
    firing: false,
    dash: false,
  };
  if (world.enemies.length === 0) {
    // Drift back to a guard spot just below the nest.
    const gx = world.nest.x;
    const gy = world.nest.y + 120;
    const dx = gx - d.x;
    const dy = gy - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) {
      snap.moveX = dx / dist;
      snap.moveY = dy / dist;
    }
    snap.aimX = d.x + Math.cos(d.aim) * 100;
    snap.aimY = d.y + Math.sin(d.aim) * 100;
    return snap;
  }

  // Nearest enemy, preferring the one closest to the nest — and above all
  // the one already chewing on it.
  let target = null;
  let bestScore = Infinity;
  for (const enemy of world.enemies) {
    const toNest = Math.hypot(enemy.x - world.nest.x, enemy.y - world.nest.y);
    const toDragon = Math.hypot(enemy.x - d.x, enemy.y - d.y);
    let score = toNest * 2 + toDragon;
    if (toNest < world.nest.radius + enemy.radius + 10) score -= 600;
    if (score < bestScore) { bestScore = score; target = enemy; }
  }
  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy) || 1;
  snap.aimX = target.x;
  snap.aimY = target.y;

  // Keep a firing distance: close in if far, back off if too close.
  const wantDist = world.flameRange * 0.62;
  if (dist > wantDist + 30) {
    snap.moveX = dx / dist;
    snap.moveY = dy / dist;
    if (dist > 420 && d.dashCooldown <= 0) snap.dash = true;
  } else if (dist < wantDist - 60) {
    snap.moveX = -dx / dist;
    snap.moveY = -dy / dist;
  } else {
    // Strafe sideways so ranged enemies keep missing.
    snap.moveX = -dy / dist;
    snap.moveY = dx / dist;
  }

  // Fire when the target is inside the cone and in range.
  const aimAngle = Math.atan2(dy, dx);
  let angleDiff = aimAngle - d.aim;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  if (dist < world.flameRange && Math.abs(angleDiff) < world.flameHalfAngle * 1.1) {
    snap.firing = true;
  }
  return snap;
}

// An idle dragon: never moves, never fires. Used to stage a real loss.
export function idleSnapshot(world) {
  const d = world.dragon;
  return {
    moveX: 0, moveY: 0,
    aimX: d.x, aimY: d.y - 100,
    firing: false,
    dash: false,
  };
}

// ---- Simulation driver --------------------------------------------------

// Step the world with the given snapshot source until `done(world)` is true
// or the step cap is hit. Handles wave transitions exactly like the live
// game: on a cleared wave it picks an upgrade and starts the next one.
// Returns true when `done` became true.
export function runSimulation(world, snapshotFn, done, maxSteps) {
  const dt = 1 / 60;
  for (let step = 0; step < maxSteps; step += 1) {
    if (world.over) break;
    if (world.waveState === 'cleared') {
      world.applyUpgrade(autopilotPickUpgrade(world));
      world.startWave(world.wave + 1);
    } else if (world.waveState === 'idle') {
      world.startWave(1);
    }
    world.update(snapshotFn(world), dt);
    if (done(world)) return true;
  }
  return done(world);
}

// Stage one screenshot mode on a fresh world. Returns the mode the game
// should freeze in ('menu', 'play', 'win' or 'loss').
export function stageShot(mode, seed) {
  const result = { mode, seed };
  if (mode === 'start') {
    result.freeze = 'menu';
    return result;
  }
  if (mode === 'play') {
    // Real play: autopilot through wave 1, freeze mid-fight in wave 2 with
    // the flame on and several enemies on screen.
    result.freeze = 'play';
    result.simulate = (world) => runSimulation(
      world,
      autopilotSnapshot,
      (w) => w.wave >= 2 && w.enemies.length >= 4 && w.dragon.flameOn && w.embers.length >= 1,
      60 * 240,
    );
    return result;
  }
  if (mode === 'win') {
    result.freeze = 'win';
    result.simulate = (world) => runSimulation(
      world,
      autopilotSnapshot,
      (w) => w.over && w.won,
      60 * 60 * 20,
    );
    return result;
  }
  if (mode === 'loss') {
    result.freeze = 'loss';
    result.simulate = (world) => runSimulation(
      world,
      idleSnapshot,
      (w) => w.over && !w.won,
      60 * 60 * 12,
    );
    return result;
  }
  result.freeze = 'menu';
  return result;
}

// Convenience for the test handle: autopilot a whole run and report how it
// ended. `mode` is 'win' (autopilot plays) or 'loss' (idle dragon).
export function autopilotRun(world, mode, maxSteps) {
  if (mode === 'loss') {
    runSimulation(world, idleSnapshot, (w) => w.over, maxSteps || 60 * 60 * 12);
  } else {
    runSimulation(world, autopilotSnapshot, (w) => w.over, maxSteps || 60 * 60 * 12);
  }
  return {
    won: world.won,
    over: world.over,
    wave: world.wave,
    score: world.score,
    kills: world.kills,
    nestHp: world.nest.hp,
    time: world.time,
  };
}

export { TOTAL_WAVES, CONFIG };
