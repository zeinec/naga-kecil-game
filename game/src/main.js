// main.js — bootstrap and the game loop for NAGA KECIL.
//
// Owns the run state machine: menu, play, upgrade, pause, win, loss.
// Each frame it reads input, steps the world (only while playing), and asks
// the renderer to draw. It also wires the test hooks: the ?shot= staging
// modes and the window.__naga handle a headless driver can inspect.

import { CONFIG } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioSynth } from './audio.js';
import { stageShot, autopilotRun, autopilotSnapshot, idleSnapshot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.arenaWidth;
canvas.height = CONFIG.arenaHeight;

const audio = new AudioSynth();
const input = new Input(canvas);
const renderer = new Renderer(canvas);
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 20261116;

let world = new World(seed, audio);
let mode = 'menu';
let frozen = false;
let ready = false;

function startRun() {
  world = new World(seed, audio);
  world.startWave(1);
  mode = 'play';
  frozen = false;
  audio.ensure();
}

function pickUpgrade(index) {
  if (mode !== 'upgrade') return;
  const card = world.upgradeChoices[index];
  if (!card) return;
  world.applyUpgrade(card.id);
  world.startWave(world.wave + 1);
  mode = 'play';
}

function togglePause() {
  if (mode === 'play') mode = 'pause';
  else if (mode === 'pause') mode = 'play';
}

function toMenu() {
  world = new World(seed, audio);
  mode = 'menu';
  frozen = false;
}

// Button / click handling: MULAI, MAIN LAGI, and upgrade cards.
function clickAt(x, y) {
  audio.ensure();
  if (mode === 'menu') {
    if (x >= 520 && x <= 760 && y >= 520 && y <= 580) startRun();
    return;
  }
  if (mode === 'win' || mode === 'loss') {
    if (x >= 520 && x <= 760 && y >= 460 && y <= 520) startRun();
    return;
  }
  if (mode === 'upgrade') {
    const cardW = 260;
    const cardH = 240;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (CONFIG.arenaWidth - total) / 2;
    for (let i = 0; i < 3; i += 1) {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= 220 && y <= 220 + cardH) {
        pickUpgrade(i);
        return;
      }
    }
  }
}

input.onClick = clickAt;
input.onPause = () => {
  if (mode === 'play' || mode === 'pause') togglePause();
};
input.onRestart = () => {
  if (mode !== 'menu') startRun();
};
input.onStart = (code) => {
  if (code === 'Enter') {
    if (mode === 'menu' || mode === 'win' || mode === 'loss') startRun();
  }
};
input.onPick = (index) => pickUpgrade(index);

// ---- Screenshot staging -------------------------------------------------

const shotMode = params.get('shot');
if (shotMode) {
  const staged = stageShot(shotMode, seed);
  if (staged.simulate) {
    world.startWave(1);
    staged.simulate(world);
  }
  mode = staged.freeze;
  frozen = true;
  ready = true;
}

// ---- Game loop ----------------------------------------------------------

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (!frozen && mode === 'play') {
    const move = input.moveVector();
    const snapshot = {
      moveX: move.x,
      moveY: move.y,
      aimX: input.mouseX,
      aimY: input.mouseY,
      firing: input.isFiring(),
      dash: input.consumePressed('ShiftLeft') || input.consumePressed('ShiftRight'),
    };
    world.update(snapshot, dt);
    // Breath sound follows the flame.
    if (world.dragon.flameOn) audio.startBreath();
    else audio.stopBreath();
    if (world.over) {
      mode = world.won ? 'win' : 'loss';
    } else if (world.waveState === 'cleared') {
      mode = 'upgrade';
    }
  } else {
    audio.stopBreath();
  }

  const ui = {
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    input,
  };
  renderer.draw(world, mode, ui);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Fit the canvas to the window while keeping its 1280x720 shape.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / CONFIG.arenaWidth, window.innerHeight / CONFIG.arenaHeight);
  canvas.style.width = `${Math.floor(CONFIG.arenaWidth * scale)}px`;
  canvas.style.height = `${Math.floor(CONFIG.arenaHeight * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

requestAnimationFrame(frame);

// ---- Test handle --------------------------------------------------------
// A headless driver reads window.__naga to see the live state and to drive
// the autopilot through the real rules.
window.__naga = {
  get mode() { return mode; },
  get wave() { return world.wave; },
  get score() { return world.score; },
  get nestHp() { return world.nest.hp; },
  get heat() { return world.dragon.heat; },
  get overheated() { return world.dragon.overheated; },
  get enemies() { return world.enemies.length; },
  get embers() { return world.emberCount; },
  get kills() { return world.kills; },
  get waveState() { return world.waveState; },
  get choices() { return world.upgradeChoices.map((c) => c.id); },
  get ready() { return ready; },
  start: startRun,
  restart: startRun,
  pick: pickUpgrade,
  pause: togglePause,
  // Drive the LIVE world forward with the autopilot (or an idle dragon) for
  // a number of simulated seconds. Stops at an upgrade offer so the driver
  // can pick a card itself. Test-only; the player path never calls this.
  drive(seconds, kind) {
    if (frozen) return { error: 'frozen' };
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i += 1) {
      if (mode !== 'play') break;
      if (world.over) break;
      const snap = kind === 'idle' ? idleSnapshot(world) : autopilotSnapshot(world);
      world.update(snap, 1 / 60);
      if (world.over) {
        mode = world.won ? 'win' : 'loss';
      } else if (world.waveState === 'cleared') {
        mode = 'upgrade';
        break;
      }
    }
    return { mode, wave: world.wave, score: world.score, nestHp: world.nest.hp, enemies: world.enemies.length };
  },
  autopilotWin() {
    const testWorld = new World(seed, audio);
    testWorld.startWave(1);
    return autopilotRun(testWorld, 'win');
  },
  autopilotLoss() {
    const testWorld = new World(seed, audio);
    testWorld.startWave(1);
    return autopilotRun(testWorld, 'loss');
  },
};

// The menu is ready as soon as the first frame is drawn.
ready = true;
