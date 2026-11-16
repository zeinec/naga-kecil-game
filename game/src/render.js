// render.js — all canvas drawing for NAGA KECIL.
//
// One Renderer owns the canvas and draws everything the player sees: the
// ember cave, the nest, the dragon, every enemy, the flame cone, embers,
// the HUD, the menus and the end screens. All art is procedural — shapes,
// gradients and glow — no image files. Flicker and glow use the world's
// simulation time, so a frozen staged frame renders identically every time.

import { CONFIG, TOTAL_WAVES } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = CONFIG.arenaWidth;
    this.H = CONFIG.arenaHeight;
  }

  // ---- Frame ------------------------------------------------------------

  draw(world, mode, ui) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.W, this.H);
    // Screen shake when the nest is hurt.
    if (world.shake > 0.2) {
      const s = world.shake;
      ctx.translate((world.time * 997 % 1 - 0.5) * s, (world.time * 613 % 1 - 0.5) * s);
    }
    this.drawCave(world);
    this.drawNest(world);
    this.drawEmbers(world);
    this.drawProjectiles(world);
    this.drawFireballs(world);
    this.drawEnemies(world);
    this.drawDragon(world);
    this.drawFlame(world);
    ctx.restore();

    if (mode === 'play' || mode === 'upgrade' || mode === 'pause') {
      this.drawHud(world, mode);
    }
    if (mode === 'upgrade') this.drawUpgradeCards(world, ui);
    if (mode === 'menu') this.drawMenu(world);
    if (mode === 'pause') this.drawPause();
    if (mode === 'win') this.drawEnd(world, true);
    if (mode === 'loss') this.drawEnd(world, false);
    if (mode === 'play' && ui.touch) this.drawTouch(world, ui);
  }

  // ---- Cave -------------------------------------------------------------

  drawCave(world) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(640, 360, 60, 640, 360, 780);
    g.addColorStop(0, '#2a1a2e');
    g.addColorStop(0.55, '#180f22');
    g.addColorStop(1, '#0a0612');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // Warm glow around the nest.
    const glow = ctx.createRadialGradient(640, 360, 10, 640, 360, 340);
    const pulse = 0.10 + 0.03 * Math.sin(world.time * 2.2);
    glow.addColorStop(0, `rgba(255, 170, 60, ${pulse + 0.10})`);
    glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.W, this.H);

    // Rocks.
    for (const rock of world.cave.rocks) {
      ctx.fillStyle = rock.shade > 0.5 ? '#241a2e' : '#1d1426';
      ctx.beginPath();
      ctx.ellipse(rock.x, rock.y, rock.r, rock.r * 0.7, rock.shade * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stalactites, top and bottom.
    ctx.fillStyle = '#150e1f';
    for (const s of world.cave.spikes) {
      ctx.beginPath();
      if (s.top) {
        ctx.moveTo(s.x - s.w / 2, 0);
        ctx.lineTo(s.x + s.w / 2, 0);
        ctx.lineTo(s.x, s.len);
      } else {
        ctx.moveTo(s.x - s.w / 2, this.H);
        ctx.lineTo(s.x + s.w / 2, this.H);
        ctx.lineTo(s.x, this.H - s.len);
      }
      ctx.closePath();
      ctx.fill();
    }
    // Cave mouth glow at the top, where dawn will break on a win.
    const mouth = ctx.createLinearGradient(0, 0, 0, 90);
    mouth.addColorStop(0, 'rgba(255, 210, 120, 0.10)');
    mouth.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = mouth;
    ctx.fillRect(0, 0, this.W, 90);
  }

  // ---- Nest -------------------------------------------------------------

  drawNest(world) {
    const ctx = this.ctx;
    const nest = world.nest;
    const broken = nest.hp <= 0;
    // Golden straw ring.
    ctx.save();
    ctx.translate(nest.x, nest.y);
    ctx.strokeStyle = broken ? '#5a4632' : '#c98f2e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, nest.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = broken ? '#4a3826' : '#e8b64c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, nest.radius - 7, 0, Math.PI * 2);
    ctx.stroke();
    // Three glowing eggs.
    const eggSpots = [[-18, 8], [16, 10], [0, -14]];
    for (let i = 0; i < eggSpots.length; i += 1) {
      const [ex, ey] = eggSpots[i];
      if (broken) {
        // Smashed: grey shards instead of glowing eggs.
        ctx.fillStyle = '#6b6258';
        ctx.beginPath();
        ctx.moveTo(ex - 8, ey + 6);
        ctx.lineTo(ex, ey - 6);
        ctx.lineTo(ex + 8, ey + 6);
        ctx.closePath();
        ctx.fill();
      } else {
        const glow = ctx.createRadialGradient(ex, ey, 1, ex, ey, 18);
        glow.addColorStop(0, 'rgba(255, 230, 150, 0.95)');
        glow.addColorStop(1, 'rgba(255, 180, 60, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ex, ey, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- Dragon -----------------------------------------------------------

  drawDragon(world) {
    const ctx = this.ctx;
    const d = world.dragon;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.aim);
    // Tail.
    ctx.fillStyle = '#2fae8f';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.quadraticCurveTo(-34, -10 - Math.sin(world.time * 6) * 4, -42, -2);
    ctx.quadraticCurveTo(-34, 8, -14, 6);
    ctx.closePath();
    ctx.fill();
    // Wings (flap gently).
    const flap = Math.sin(world.time * 9) * 0.25;
    ctx.fillStyle = '#1f8f74';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap));
      ctx.beginPath();
      ctx.moveTo(0, side * 8);
      ctx.quadraticCurveTo(-22, side * 30, -34, side * 26);
      ctx.quadraticCurveTo(-18, side * 12, 0, side * 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Body: small and round, teal-green with an orange belly.
    ctx.fillStyle = '#35c99e';
    ctx.beginPath();
    ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.ellipse(6, 8, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Horns.
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(6, -16);
    ctx.lineTo(12, -28);
    ctx.lineTo(16, -14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 16);
    ctx.lineTo(12, 28);
    ctx.lineTo(16, 14);
    ctx.closePath();
    ctx.fill();
    // Snout and glowing eyes.
    ctx.fillStyle = '#2fae8f';
    ctx.beginPath();
    ctx.ellipse(16, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(10, -8, 3.4, 0, Math.PI * 2);
    ctx.arc(10, 8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(11, -8, 1.6, 0, Math.PI * 2);
    ctx.arc(11, 8, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Overheat warning ring.
    if (d.overheated) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, d.radius + 10, world.time * 3, world.time * 3 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFlame(world) {
    const ctx = this.ctx;
    const d = world.dragon;
    if (!d.flameOn) return;
    const flick = 0.85 + d.flameFlicker * 0.3;
    const range = world.flameRange * flick;
    const half = world.flameHalfAngle * (0.9 + d.flameFlicker * 0.2);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.aim);
    // Outer glow, then a bright core.
    const layers = [
      { r: range, a: half, color: 'rgba(255, 120, 20, 0.30)' },
      { r: range * 0.75, a: half * 0.7, color: 'rgba(255, 180, 40, 0.45)' },
      { r: range * 0.5, a: half * 0.45, color: 'rgba(255, 240, 150, 0.65)' },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.arc(0, 0, layer.r, -layer.a, layer.a);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Enemies ----------------------------------------------------------

  drawEnemies(world) {
    for (const enemy of world.enemies) {
      if (enemy.type === 'bat') this.drawBat(enemy, world);
      else if (enemy.type === 'knight') this.drawKnight(enemy, world);
      else if (enemy.type === 'archer') this.drawArcher(enemy, world);
      else if (enemy.type === 'witch') this.drawWitch(enemy, world);
      else if (enemy.type === 'boss') this.drawBoss(enemy, world);
      // Hit flash.
      if (enemy.flash > 0) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = enemy.flash * 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Health bar for tough enemies.
      if (enemy.maxHp > 40) {
        const ctx = this.ctx;
        const w = enemy.radius * 2;
        const frac = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5);
        ctx.fillStyle = frac > 0.5 ? '#4ade80' : '#ef4444';
        ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * frac, 5);
      }
    }
    // Boss name banner.
    if (world.boss && world.boss.hp > 0) {
      const ctx = this.ctx;
      const phaseText = world.bossPhase === 2 ? ' — FASE 2: HUJAN PANAH' : '';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#ff6b6b';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 5;
      const label = `PEMBURU NAGA${phaseText}`;
      ctx.strokeText(label, 640, 96);
      ctx.fillText(label, 640, 96);
      ctx.restore();
    }
  }

  drawBat(enemy, world) {
    const ctx = this.ctx;
    const flap = Math.sin(enemy.wobble * 3) * 0.4;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(Math.sin(enemy.wobble) * 0.2);
    ctx.fillStyle = '#7c3aed';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.4 + flap));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-16, side * 16, -26, side * 10);
      ctx.quadraticCurveTo(-12, side * 4, 0, side * 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#5b21b6';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.arc(-4, -3, 2.2, 0, Math.PI * 2);
    ctx.arc(4, -3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawKnight(enemy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // Shield first (the silhouette that says "tough").
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(-enemy.radius, -6);
    ctx.lineTo(-enemy.radius - 6, 0);
    ctx.lineTo(-enemy.radius, 16);
    ctx.quadraticCurveTo(-enemy.radius + 10, 22, 0, 18);
    ctx.lineTo(enemy.radius, 10);
    ctx.lineTo(enemy.radius, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(4, -2, enemy.radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
    // Helmet slit.
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-2, -8, 14, 4);
    // Sword.
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(28, 20);
    ctx.stroke();
    ctx.restore();
  }

  drawArcher(enemy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // Hood.
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.quadraticCurveTo(enemy.radius, -enemy.radius, enemy.radius, 0);
    ctx.quadraticCurveTo(enemy.radius, enemy.radius, 0, enemy.radius);
    ctx.quadraticCurveTo(-enemy.radius, enemy.radius, -enemy.radius, 0);
    ctx.quadraticCurveTo(-enemy.radius, -enemy.radius, 0, -enemy.radius);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(-3, -3, 1.6, 0, Math.PI * 2);
    ctx.arc(3, -3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Bow.
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(14, 0, 14, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }

  drawWitch(enemy, world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // Robe.
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius + 4);
    ctx.quadraticCurveTo(enemy.radius, enemy.radius, enemy.radius * 0.8, enemy.radius);
    ctx.lineTo(-enemy.radius * 0.8, enemy.radius);
    ctx.quadraticCurveTo(-enemy.radius, enemy.radius, 0, -enemy.radius + 4);
    ctx.fill();
    // Pointy hat.
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(0, -enemy.radius - 16);
    ctx.lineTo(12, -10);
    ctx.closePath();
    ctx.fill();
    // Glowing orb in hand.
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 5 + enemy.wobble);
    ctx.fillStyle = `rgba(216, 180, 254, ${pulse})`;
    ctx.beginPath();
    ctx.arc(12, 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.arc(-3, -4, 2, 0, Math.PI * 2);
    ctx.arc(4, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBoss(enemy, world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // Big dark-red armour.
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    // Horned helmet.
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, -6, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(-16, -16);
    ctx.lineTo(-30, -30);
    ctx.lineTo(-10, -22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -16);
    ctx.lineTo(30, -30);
    ctx.lineTo(10, -22);
    ctx.closePath();
    ctx.fill();
    // Glowing red eyes.
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(-7, -8, 3.4, 0, Math.PI * 2);
    ctx.arc(7, -8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // Sword (phase 1) or bow (phase 2).
    if (world.bossPhase === 2) {
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(26, 0, 20, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(24, 10);
      ctx.lineTo(48, 34);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Projectiles, fireballs, embers -----------------------------------

  drawProjectiles(world) {
    const ctx = this.ctx;
    for (const p of world.projectiles) {
      if (p.kind === 'orb') {
        ctx.fillStyle = '#d8b4fe';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Arrow / rain arrow: a small dart along its velocity.
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(2, -4);
        ctx.lineTo(2, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawFireballs(world) {
    const ctx = this.ctx;
    for (const f of world.fireballs) {
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.radius * 2);
      g.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 140, 30, 0.7)');
      g.addColorStop(1, 'rgba(255, 80, 10, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEmbers(world) {
    const ctx = this.ctx;
    for (const e of world.embers) {
      const twinkle = 0.6 + 0.4 * Math.sin(world.time * 8 + e.x);
      ctx.fillStyle = `rgba(45, 212, 191, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- HUD --------------------------------------------------------------

  drawHud(world, mode) {
    const ctx = this.ctx;
    ctx.save();
    // Top bar.
    ctx.fillStyle = 'rgba(8, 5, 14, 0.72)';
    ctx.fillRect(0, 0, this.W, 64);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`GELOMBANG ${Math.max(1, world.wave)}/${TOTAL_WAVES}`, 20, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`SKOR ${world.score}`, 330, 39);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillText(`EMBER ${world.emberCount}`, 560, 39);

    // Nest HP as five flames.
    const flames = 5;
    const filled = Math.ceil((world.nest.hp / world.nest.maxHp) * flames);
    for (let i = 0; i < flames; i += 1) {
      const x = 800 + i * 34;
      this.drawFlameIcon(x, 32, i < filled);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${Math.ceil(world.nest.hp)}`, 980, 39);

    // Heat meter.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(1060, 22, 180, 20);
    const heatFrac = world.dragon.heat / 100;
    ctx.fillStyle = world.dragon.overheated ? '#ef4444' : (heatFrac > 0.75 ? '#f97316' : '#fbbf24');
    ctx.fillRect(1060, 22, 180 * heatFrac, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1060, 22, 180, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.dragon.overheated ? 'PANAS! ' : 'PANAS', 1150, 58);
    ctx.restore();
  }

  drawFlameIcon(x, y, lit) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = lit ? '#ff8c1a' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(9, -2, 7, 6);
    ctx.quadraticCurveTo(3, 11, 0, 11);
    ctx.quadraticCurveTo(-3, 11, -7, 6);
    ctx.quadraticCurveTo(-9, -2, 0, -12);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(5, 2, 3, 7);
      ctx.quadraticCurveTo(0, 9, -3, 7);
      ctx.quadraticCurveTo(-5, 2, 0, -4);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Menus ------------------------------------------------------------

  panel(x, y, w, h, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(10, 6, 18, ${alpha || 0.82})`;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawMenu(world) {
    const ctx = this.ctx;
    ctx.save();
    // Dim the cave a touch so the title pops.
    ctx.fillStyle = 'rgba(5, 3, 10, 0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.panel(290, 110, 700, 500, 0.88);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 84px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 8;
    ctx.strokeText('NAGA KECIL', 640, 220);
    ctx.fillText('NAGA KECIL', 640, 220);
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Jaga sarangmu dari para pemburu — 8 gelombang!', 640, 268);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    const lines = [
      'WASD / Panah — bergerak      Mouse — mengarah',
      'Tahan Klik / Spasi — sembur api (jangan sampai panas!)',
      'Shift — dash      R — mulai lagi      Esc — jeda',
      'Sentuh: joystick kiri + tombol API kanan',
      '',
      'Kalahkan musuh, kumpulkan ember, pilih kartu di antara gelombang.',
      'Jika HP sarang habis, sarangmu hancur.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 640, 316 + i * 30));
    // MULAI button.
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.roundRect(520, 520, 240, 60, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('MULAI', 640, 560);
    ctx.restore();
  }

  drawUpgradeCards(world, ui) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 3, 10, 0.6)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(`GELOMBANG ${world.wave} SELESAI!`, 640, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Pilih satu kartu:', 640, 168);
    const cardW = 260;
    const cardH = 240;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (this.W - total) / 2;
    world.upgradeChoices.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      const y = 220;
      ctx.fillStyle = 'rgba(20, 12, 32, 0.95)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2dd4bf';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`[ ${i + 1} ]`, 640 + (x + cardW / 2 - 640), y + 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      this.wrapText(card.title, x + cardW / 2, y + 74, cardW - 32, 26);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '18px sans-serif';
      this.wrapText(card.desc, x + cardW / 2, y + 122, cardW - 32, 24);
    });
    ctx.restore();
  }

  wrapText(text, cx, y, maxWidth, lineHeight) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  drawPause() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 3, 10, 0.65)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('JEDA', 640, 340);
    ctx.font = '22px sans-serif';
    ctx.fillText('Tekan Esc / P untuk lanjut — R untuk mulai lagi', 640, 390);
    ctx.restore();
  }

  drawEnd(world, won) {
    const ctx = this.ctx;
    ctx.save();
    if (won) {
      // Dawn breaks over the cave mouth.
      const dawn = ctx.createLinearGradient(0, 0, 0, 420);
      dawn.addColorStop(0, 'rgba(255, 200, 90, 0.55)');
      dawn.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = dawn;
      ctx.fillRect(0, 0, this.W, 420);
    } else {
      ctx.fillStyle = 'rgba(10, 2, 4, 0.6)';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    this.panel(340, 150, 600, 420, 0.9);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#fbbf24' : '#ef4444';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText(won ? 'SARANG SELAMAT!' : 'SARANG HANCUR', 640, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px sans-serif';
    ctx.fillText(
      won ? 'Fajar terbit. Telur-telurmu aman — naga kecil menang!' : 'Para pemburu menghancurkan sarangmu...',
      640, 300,
    );
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#2dd4bf';
    ctx.fillText(`SKOR AKHIR: ${world.score}`, 640, 360);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Gelombang: ${world.wave}/${TOTAL_WAVES}    Musuh dikalahkan: ${world.kills}    Ember: ${world.emberCount}`, 640, 400);
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.roundRect(520, 460, 240, 60, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('MAIN LAGI', 640, 500);
    ctx.restore();
  }

  drawTouch(world, ui) {
    const ctx = this.ctx;
    const input = ui.input;
    ctx.save();
    // Joystick base + knob.
    if (input.joyActive) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(input.joyBaseX, input.joyBaseY, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(input.joyBaseX + input.joyX * 60, input.joyBaseY + input.joyY * 60, 30, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(140, 580, 70, 0, Math.PI * 2);
      ctx.stroke();
    }
    // FIRE button.
    ctx.fillStyle = input.touchFiring ? 'rgba(249, 115, 22, 0.85)' : 'rgba(249, 115, 22, 0.45)';
    ctx.beginPath();
    ctx.arc(1140, 580, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('API', 1140, 588);
    ctx.restore();
  }
}
