// input.js — every input device in one place: keyboard, mouse and touch.
//
// The game loop never reads the DOM directly. It reads a plain snapshot from
// here: which way the player wants to move, where they are aiming, whether
// they are holding fire, and edge-triggered actions (dash, pause, restart,
// upgrade picks). The autopilot builds the same snapshot shape, so the
// simulation cannot tell a human from a script.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    // Mouse position in canvas (logical) coordinates.
    this.mouseX = 640;
    this.mouseY = 300;
    this.mouseDown = false;
    // Virtual joystick state for touch.
    this.joyActive = false;
    this.joyId = null;
    this.joyBaseX = 0;
    this.joyBaseY = 0;
    this.joyX = 0;
    this.joyY = 0;
    this.fireTouchId = null;
    this.touchFiring = false;
    // Edge-triggered actions, consumed once per frame by the game loop.
    this.pressed = new Set();
    // Callbacks the game wires up (menu clicks, card picks, buttons).
    this.onPause = null;
    this.onRestart = null;
    this.onStart = null;
    this.onPick = null;
    this.onClick = null;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (this.onPause) this.onPause();
      }
      if (event.code === 'KeyR') {
        if (this.onRestart) this.onRestart();
      }
      if (event.code === 'Enter' || event.code === 'Space') {
        // Space is also the fire key; the game decides by state which wins.
        if (this.onStart) this.onStart(event.code);
      }
      if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
        if (this.onPick) this.onPick(Number(event.code.slice(-1)) - 1);
      }
      // Keep the page from scrolling on game keys.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.touchFiring = false;
    });

    this.canvas.addEventListener('mousemove', (event) => {
      const p = this.toLogical(event.clientX, event.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      const p = this.toLogical(event.clientX, event.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseDown = true;
      if (this.onClick) this.onClick(p.x, p.y);
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // Touch: left half of the screen is a floating joystick, the FIRE
    // button (drawn by the renderer) is a big circle bottom-right.
    this.canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      for (const touch of event.changedTouches) {
        const p = this.toLogical(touch.clientX, touch.clientY);
        if (p.x < 640 && this.joyId === null) {
          this.joyId = touch.identifier;
          this.joyActive = true;
          this.joyBaseX = p.x;
          this.joyBaseY = p.y;
          this.joyX = 0;
          this.joyY = 0;
        } else if (this.fireTouchId === null) {
          this.fireTouchId = touch.identifier;
          this.touchFiring = true;
          this.mouseX = p.x;
          this.mouseY = p.y;
          if (this.onClick) this.onClick(p.x, p.y);
        }
      }
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      for (const touch of event.changedTouches) {
        if (touch.identifier === this.joyId) {
          const p = this.toLogical(touch.clientX, touch.clientY);
          const dx = p.x - this.joyBaseX;
          const dy = p.y - this.joyBaseY;
          const len = Math.hypot(dx, dy);
          const max = 70;
          const scale = len > max ? max / len : 1;
          this.joyX = (dx * scale) / max;
          this.joyY = (dy * scale) / max;
        } else if (touch.identifier === this.fireTouchId) {
          const p = this.toLogical(touch.clientX, touch.clientY);
          this.mouseX = p.x;
          this.mouseY = p.y;
        }
      }
    }, { passive: false });
    const endTouch = (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier === this.joyId) {
          this.joyId = null;
          this.joyActive = false;
          this.joyX = 0;
          this.joyY = 0;
        }
        if (touch.identifier === this.fireTouchId) {
          this.fireTouchId = null;
          this.touchFiring = false;
        }
      }
    };
    this.canvas.addEventListener('touchend', endTouch);
    this.canvas.addEventListener('touchcancel', endTouch);
  }

  // Convert a client (screen) point to logical canvas coordinates.
  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  // Movement keys as a normalised vector, or the joystick if it is active.
  moveVector() {
    if (this.joyActive && (this.joyX !== 0 || this.joyY !== 0)) {
      return { x: this.joyX, y: this.joyY };
    }
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  isFiring() {
    return this.mouseDown || this.keys.has('Space') || this.touchFiring;
  }

  // True once, on the frame the key went down; the loop clears it.
  consumePressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }
}

// The snapshot the world simulation consumes each step. Human input and the
// autopilot both produce one of these, so the rules stay identical.
export function emptySnapshot() {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 640,
    aimY: 300,
    firing: false,
    dash: false,
  };
}
