import { DAS, ARR } from '@shared/constants.js';

const MAX_ARR_MOVES_PER_FRAME = 10;
const MAX_EFFECTIVE_DELTA = 50; // Cap deltaMs to prevent lag spike bursts

const STORAGE_KEY = 'tetris-keybindings';

const DEFAULT_BINDINGS = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'Space',
  rotateCW: 'ArrowUp',
  rotateCCW: 'KeyZ',
  rotate180: 'KeyA',
  hold: 'KeyC'
};

export class InputHandler {
  static DEFAULT_BINDINGS = DEFAULT_BINDINGS;

  static getKeyLabel(code) {
    if (!code) return '???';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
    const map = {
      ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
      Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
      ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
      AltLeft: 'L-ALT', AltRight: 'R-ALT',
      Enter: 'ENTER', Backspace: 'BACKSPACE', Tab: 'TAB',
      CapsLock: 'CAPS', Escape: 'ESC',
      Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
      BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=',
      Backslash: '\\'
    };
    return map[code] || code;
  }

  constructor() {
    this.bindings = this._loadBindings();

    this.keysDown = new Set();
    this.keysJustPressed = new Set();

    // DAS/ARR state
    this.dasLeft = { held: false, dasTimer: 0, arrTimer: 0, fired: false };
    this.dasRight = { held: false, dasTimer: 0, arrTimer: 0, fired: false };
    this.softDropHeld = false;
    this._prevSoftDropHeld = false;

    // Double-tap soft drop → hard drop
    this._lastSoftDropTapTime = 0;
    this._doubleTapWindow = 250; // ms

    // Actions queue for this frame
    this.actions = [];

    // Settings (can be adjusted)
    this.das = DAS;
    this.arr = ARR;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onBlur);
    this._reset();
  }

  _reset() {
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.dasLeft = { held: false, dasTimer: 0, arrTimer: 0, fired: false };
    this.dasRight = { held: false, dasTimer: 0, arrTimer: 0, fired: false };
    this.softDropHeld = false;
    this._prevSoftDropHeld = false;
    this._lastSoftDropTapTime = 0;
    this.actions = [];
  }

  _onBlur() {
    this._reset();
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    this.keysDown.add(e.code);
    this.keysJustPressed.add(e.code);

    // Prevent browser defaults for game keys
    const gameKeys = Object.values(this.bindings);
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keysDown.delete(e.code);
  }

  update(deltaMs) {
    this.actions = [];

    // Cap deltaMs to prevent lag spike movement bursts
    const effectiveDelta = Math.min(deltaMs, MAX_EFFECTIVE_DELTA);

    // --- DAS/ARR for movement (process BEFORE hard drop) ---
    this._updateDAS(this.dasLeft, this.bindings.moveLeft, -1, effectiveDelta);
    this._updateDAS(this.dasRight, this.bindings.moveRight, 1, effectiveDelta);

    // --- Single-fire actions (just pressed) ---
    if (this.keysJustPressed.has(this.bindings.rotateCW)) {
      this.actions.push({ type: 'rotate', direction: 1 });
    }
    if (this.keysJustPressed.has(this.bindings.rotateCCW)) {
      this.actions.push({ type: 'rotate', direction: -1 });
    }
    if (this.keysJustPressed.has(this.bindings.rotate180)) {
      this.actions.push({ type: 'rotate', direction: 2 });
    }
    if (this.keysJustPressed.has(this.bindings.hold)) {
      this.actions.push({ type: 'hold' });
    }

    // Hard drop LAST so movement/rotation happens first
    if (this.keysJustPressed.has(this.bindings.hardDrop)) {
      this.actions.push({ type: 'hardDrop' });
    }

    // --- Soft drop (edge-triggered) + double-tap → hard drop ---
    const nowSoftDrop = this.keysDown.has(this.bindings.softDrop);
    const softDropJustPressed = this.keysJustPressed.has(this.bindings.softDrop);

    if (softDropJustPressed) {
      const now = performance.now();
      if (now - this._lastSoftDropTapTime < this._doubleTapWindow) {
        // Double-tap: hard drop
        this.actions.push({ type: 'softDrop', active: false });
        this.actions.push({ type: 'hardDrop' });
        this._lastSoftDropTapTime = 0;
      } else {
        this._lastSoftDropTapTime = now;
        this.actions.push({ type: 'softDrop', active: true });
      }
    } else if (!nowSoftDrop && this._prevSoftDropHeld) {
      this.actions.push({ type: 'softDrop', active: false });
    }

    this.softDropHeld = nowSoftDrop;
    this._prevSoftDropHeld = nowSoftDrop;

    // Clear just-pressed keys at end of frame
    this.keysJustPressed.clear();
  }

  _updateDAS(state, keyCode, direction, deltaMs) {
    const isHeld = this.keysDown.has(keyCode);
    const justPressed = this.keysJustPressed.has(keyCode);

    if (!isHeld) {
      state.held = false;
      state.dasTimer = 0;
      state.arrTimer = 0;
      state.fired = false;
      return;
    }

    if (justPressed) {
      // First press: immediate move
      this.actions.push({ type: 'move', dx: direction });
      state.held = true;
      state.dasTimer = 0;
      state.arrTimer = 0;
      state.fired = false;
      return;
    }

    if (state.held) {
      state.dasTimer += deltaMs;

      if (state.dasTimer >= this.das) {
        if (!state.fired) {
          // DAS just kicked in
          state.fired = true;
          state.arrTimer = 0;

          if (this.arr === 0) {
            // Instant: move to wall (only once when DAS fires)
            this.actions.push({ type: 'moveToWall', dx: direction });
          } else {
            this.actions.push({ type: 'move', dx: direction });
          }
        } else {
          // ARR repeat
          if (this.arr === 0) {
            // ARR=0: already at wall, no need to re-emit every frame
          } else {
            state.arrTimer += deltaMs;
            let moves = 0;
            while (state.arrTimer >= this.arr && moves < MAX_ARR_MOVES_PER_FRAME) {
              state.arrTimer -= this.arr;
              this.actions.push({ type: 'move', dx: direction });
              moves++;
            }
            // Prevent leftover accumulation from causing burst next frame
            if (moves >= MAX_ARR_MOVES_PER_FRAME) {
              state.arrTimer = 0;
            }
          }
        }
      }
    }
  }

  getActions() {
    return this.actions;
  }

  _loadBindings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate: must have all expected keys
        const result = { ...DEFAULT_BINDINGS };
        for (const key of Object.keys(DEFAULT_BINDINGS)) {
          if (typeof parsed[key] === 'string') result[key] = parsed[key];
        }
        return result;
      }
    } catch { /* ignore corrupt data */ }
    return { ...DEFAULT_BINDINGS };
  }

  saveBindings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
  }

  setBinding(action, keyCode) {
    // Swap if another action already uses this key
    const existing = Object.entries(this.bindings).find(([, v]) => v === keyCode);
    if (existing && existing[0] !== action) {
      this.bindings[existing[0]] = this.bindings[action];
    }
    this.bindings[action] = keyCode;
    this.saveBindings();
  }

  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.saveBindings();
  }
}
