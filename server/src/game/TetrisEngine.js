import {
  BOARD_WIDTH, BOARD_HEIGHT, BUFFER_ZONE, TOTAL_ROWS,
  DEFAULT_GRAVITY, SOFT_DROP_FACTOR, LOCK_DELAY, MAX_LOCK_RESETS,
  ATTACK_TABLE, COMBO_TABLE, B2B_BONUS, SCORE_TABLE,
  LINES_PER_LEVEL, NEXT_PREVIEW_COUNT,
  getGravityForLevel
} from '@tetris/shared';

import {
  PIECE_SHAPES, PIECE_SPAWN, PIECE_COLORS,
  WALL_KICK_JLSTZ, WALL_KICK_I,
  T_CORNERS, T_FRONT_CORNERS
} from '@tetris/shared';

import { PieceGenerator } from './PieceGenerator.js';

export class TetrisEngine {
  constructor(seed, options = {}) {
    this.seed = seed;
    // Board: TOTAL_ROWS x BOARD_WIDTH, null = empty, string = piece type
    this.board = Array.from({ length: TOTAL_ROWS }, () => Array(BOARD_WIDTH).fill(null));

    this.currentPiece = null;  // { type, rotation, col, row }
    this.holdPiece = null;
    this.holdUsed = false;

    this.pieceGenerator = new PieceGenerator(seed);

    // Stats
    this.score = 0;
    this.linesCleared = 0;
    this.startingLevel = options.startingLevel || 1;
    this.level = this.startingLevel;
    this.combo = -1;      // -1 = no active combo
    this.backToBack = -1;  // -1 = no B2B streak
    this.isAlive = true;
    this.piecesPlaced = 0;

    // Gravity
    this.gravityTimer = 0;
    this.softDropping = false;

    // Lock delay
    this.lockDelayMs = LOCK_DELAY;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.isOnGround = false;

    // Last action tracking for T-spin detection
    this.lastAction = null; // 'rotate' | 'move' | null
    this.lastKickIndex = 0; // which wall kick test succeeded

    // Pending attack result from last lock
    this.lastAttackResult = null;
  }

  // --- Piece Spawning ---

  spawnPiece() {
    const type = this.pieceGenerator.next();
    return this._spawnSpecificPiece(type);
  }

  _spawnSpecificPiece(type) {
    this.currentPiece = {
      type,
      rotation: 0,
      col: PIECE_SPAWN.col,
      row: PIECE_SPAWN.row
    };
    this.holdUsed = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.isOnGround = false;
    this.lastAction = null;

    // Check if spawn position is valid
    if (this._checkCollision(this.currentPiece)) {
      this.isAlive = false;
      return false;
    }
    return true;
  }

  // --- Movement ---

  movePiece(dx, dy) {
    if (!this.currentPiece || !this.isAlive) return false;

    const testPiece = {
      ...this.currentPiece,
      col: this.currentPiece.col + dx,
      row: this.currentPiece.row + dy
    };

    if (this._checkCollision(testPiece)) return false;

    this.currentPiece.col = testPiece.col;
    this.currentPiece.row = testPiece.row;
    this.lastAction = 'move';

    // Reset lock delay on successful move (if on ground)
    if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }

    // Update ground status
    this.isOnGround = this._isOnGround();

    return true;
  }

  // --- Rotation (SRS) ---

  rotatePiece(direction) {
    if (!this.currentPiece || !this.isAlive) return false;
    if (this.currentPiece.type === 'O') return false; // O doesn't rotate

    const fromState = this.currentPiece.rotation;
    const toState = ((fromState + direction) % 4 + 4) % 4; // handle negative
    const kickKey = `${fromState}>${toState}`;

    const kickTable = this.currentPiece.type === 'I' ? WALL_KICK_I : WALL_KICK_JLSTZ;
    const kicks = kickTable[kickKey];

    if (!kicks) return false;

    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      const testPiece = {
        ...this.currentPiece,
        rotation: toState,
        col: this.currentPiece.col + dx,
        row: this.currentPiece.row + dy
      };

      if (!this._checkCollision(testPiece)) {
        this.currentPiece.rotation = toState;
        this.currentPiece.col = testPiece.col;
        this.currentPiece.row = testPiece.row;
        this.lastAction = 'rotate';
        this.lastKickIndex = i;

        // Reset lock delay on successful rotation
        if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
          this.lockTimer = 0;
          this.lockResets++;
        }

        this.isOnGround = this._isOnGround();
        return true;
      }
    }

    return false;
  }

  // --- Hard Drop ---

  hardDrop() {
    if (!this.currentPiece || !this.isAlive) return null;

    let dropDistance = 0;
    while (this.movePiece(0, 1)) {
      dropDistance++;
    }

    this.score += dropDistance * SCORE_TABLE.hardDrop;
    return this._lockPiece();
  }

  // --- Soft Drop ---

  setSoftDrop(active) {
    this.softDropping = active;
  }

  setLockDelayMs(lockDelayMs) {
    this.lockDelayMs = Math.max(LOCK_DELAY, lockDelayMs || LOCK_DELAY);
  }

  // --- Hold ---

  holdSwap() {
    if (!this.currentPiece || !this.isAlive || this.holdUsed) return false;

    const currentType = this.currentPiece.type;

    if (this.holdPiece) {
      const holdType = this.holdPiece;
      this.holdPiece = currentType;
      this._spawnSpecificPiece(holdType);
    } else {
      this.holdPiece = currentType;
      this.spawnPiece();
    }

    this.holdUsed = true;
    return true;
  }

  // --- Gravity & Lock Delay ---

  updateGravity(deltaMs) {
    if (!this.currentPiece || !this.isAlive) return;

    const gravity = this.softDropping
      ? getGravityForLevel(this.level) / SOFT_DROP_FACTOR
      : getGravityForLevel(this.level);

    this.gravityTimer += deltaMs;

    while (this.gravityTimer >= gravity) {
      this.gravityTimer -= gravity;
      if (!this.movePiece(0, 1)) {
        // Piece can't move down
        this.gravityTimer = 0;
        break;
      }
      if (this.softDropping) {
        this.score += SCORE_TABLE.softDrop;
      }
    }

    this.isOnGround = this._isOnGround();
  }

  updateLockDelay(deltaMs) {
    if (!this.currentPiece || !this.isAlive) return null;

    if (this.isOnGround) {
      this.lockTimer += deltaMs;
      if (this.lockTimer >= this.lockDelayMs || this.lockResets >= MAX_LOCK_RESETS) {
        return this._lockPiece();
      }
    } else {
      this.lockTimer = 0;
    }

    return null;
  }

  // --- Internal: Collision Detection ---

  _checkCollision(piece) {
    const cells = this._getPieceCells(piece);
    for (const [col, row] of cells) {
      if (col < 0 || col >= BOARD_WIDTH || row < 0 || row >= TOTAL_ROWS) {
        return true;
      }
      if (this.board[row][col] !== null) {
        return true;
      }
    }
    return false;
  }

  _getPieceCells(piece) {
    const shape = PIECE_SHAPES[piece.type][piece.rotation];
    return shape.map(([c, r]) => [c + piece.col, r + piece.row]);
  }

  _isOnGround() {
    if (!this.currentPiece) return false;
    const testPiece = {
      ...this.currentPiece,
      row: this.currentPiece.row + 1
    };
    return this._checkCollision(testPiece);
  }

  // --- Internal: Lock Piece ---

  _lockPiece() {
    if (!this.currentPiece) return null;

    const cells = this._getPieceCells(this.currentPiece);

    // Lock-out check: if entire piece is above visible playfield, game over
    const allAbovePlayfield = cells.every(([col, row]) => row < BUFFER_ZONE);
    if (allAbovePlayfield) {
      this.isAlive = false;
      return {
        linesCleared: 0,
        attack: 0,
        clearType: null,
        combo: -1,
        backToBack: this.backToBack,
        isPerfectClear: false,
        isTSpin: false,
        isMini: false,
        clearedRows: []
      };
    }

    // Write piece to board
    for (const [col, row] of cells) {
      if (row >= 0 && row < TOTAL_ROWS && col >= 0 && col < BOARD_WIDTH) {
        this.board[row][col] = this.currentPiece.type;
      }
    }

    this.piecesPlaced++;

    // Check for T-spin before clearing lines
    const tSpinResult = this._detectTSpin();

    // Clear lines
    const clearResult = this._clearLines();

    // Calculate attack
    const attack = this._processLineClear(clearResult, tSpinResult);

    // Spawn next piece
    this.currentPiece = null;
    this.spawnPiece();

    this.lastAttackResult = attack;
    return attack;
  }

  // --- Internal: T-Spin Detection ---

  _detectTSpin() {
    if (!this.currentPiece || this.currentPiece.type !== 'T') {
      return { isTSpin: false, isMini: false };
    }

    if (this.lastAction !== 'rotate') {
      return { isTSpin: false, isMini: false };
    }

    // 3-corner rule: check 4 corners of the T piece's 3x3 bounding box
    const { col, row, rotation } = this.currentPiece;
    let filledCorners = 0;
    let frontFilled = 0;

    for (const [dc, dr] of T_CORNERS) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= BOARD_WIDTH || r < 0 || r >= TOTAL_ROWS || this.board[r][c] !== null) {
        filledCorners++;
      }
    }

    if (filledCorners < 3) {
      return { isTSpin: false, isMini: false };
    }

    // Check front corners for mini vs full
    const frontCornerDefs = T_FRONT_CORNERS[rotation];
    for (const [dc, dr] of frontCornerDefs) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= BOARD_WIDTH || r < 0 || r >= TOTAL_ROWS || this.board[r][c] !== null) {
        frontFilled++;
      }
    }

    // If both front corners filled -> full T-spin
    // If only one (or using kick test 4) -> T-spin mini (unless kick index is 4 which makes it full)
    const isFull = frontFilled === 2 || this.lastKickIndex === 4;

    return { isTSpin: true, isMini: !isFull };
  }

  // --- Internal: Line Clearing ---

  _clearLines() {
    const clearedRows = [];

    for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== null)) {
        clearedRows.push(r);
      }
    }

    if (clearedRows.length === 0) return { count: 0, rows: [], isPerfectClear: false };

    // Sort descending to ensure splice indices stay valid
    clearedRows.sort((a, b) => b - a);

    // Remove cleared rows and add empty rows at top
    for (const r of clearedRows) {
      this.board.splice(r, 1);
    }
    for (let i = 0; i < clearedRows.length; i++) {
      this.board.unshift(Array(BOARD_WIDTH).fill(null));
    }

    // Check perfect clear
    const isPerfectClear = this.board.every(row => row.every(cell => cell === null));

    return { count: clearedRows.length, rows: clearedRows, isPerfectClear };
  }

  // --- Internal: Process Line Clear & Calculate Attack ---

  _processLineClear(clearResult, tSpinResult) {
    const { count, isPerfectClear } = clearResult;

    if (count === 0) {
      // T-spin zero still awards score
      if (tSpinResult.isTSpin) {
        const zeroType = tSpinResult.isMini ? 'tSpinMini' : 'tSpin';
        const baseScore = SCORE_TABLE[zeroType] || 0;
        this.score += baseScore * this.level;
      }
      this.combo = -1;
      return { linesCleared: 0, attack: 0, clearType: null, combo: -1, backToBack: this.backToBack, isPerfectClear: false, isTSpin: tSpinResult.isTSpin, isMini: tSpinResult.isMini };
    }

    this.combo++;
    this.linesCleared += count;

    // Determine clear type
    let clearType;
    let isDifficult = false;

    if (tSpinResult.isTSpin) {
      if (tSpinResult.isMini) {
        const miniTypes = ['tSpinMini', 'tSpinMiniSingle', 'tSpinMiniDouble'];
        clearType = miniTypes[count] || 'tSpinMiniDouble';
      } else {
        const fullTypes = ['tSpin', 'tSpinSingle', 'tSpinDouble', 'tSpinTriple'];
        clearType = fullTypes[count] || 'tSpinTriple';
      }
      isDifficult = count > 0; // T-spin with line clears is "difficult"
    } else {
      const normalTypes = [null, 'single', 'double', 'triple', 'tetris'];
      clearType = normalTypes[count] || 'tetris';
      isDifficult = count === 4; // Only Tetris is "difficult" for normal clears
    }

    // Base attack
    let attack = ATTACK_TABLE[clearType] || 0;

    // Back-to-Back bonus
    if (isDifficult) {
      if (this.backToBack >= 0) {
        attack += B2B_BONUS;
      }
      this.backToBack++;
    } else {
      this.backToBack = -1;
    }

    // Combo bonus
    const comboIndex = Math.min(this.combo, COMBO_TABLE.length - 1);
    attack += COMBO_TABLE[comboIndex];

    // Perfect clear bonus
    if (isPerfectClear) {
      attack = ATTACK_TABLE.perfectClear;
    }

    // Score
    let baseScore = SCORE_TABLE[clearType] || 0;
    if (this.backToBack > 0) baseScore = Math.floor(baseScore * 1.5);
    this.score += baseScore * this.level;

    // Level up
    const newLevel = Math.floor(this.linesCleared / LINES_PER_LEVEL) + this.startingLevel;
    if (newLevel > this.level) {
      this.level = newLevel;
    }

    return {
      linesCleared: count,
      attack,
      clearType,
      combo: this.combo,
      backToBack: this.backToBack,
      clearedRows: clearResult.rows,
      isPerfectClear,
      isTSpin: tSpinResult.isTSpin,
      isMini: tSpinResult.isMini
    };
  }

  // --- Garbage Application ---

  applyGarbage(lines, gapColumn) {
    if (lines <= 0) return;

    // Check if top rows being removed contain blocks (top-out)
    for (let r = 0; r < Math.min(lines, BUFFER_ZONE); r++) {
      if (this.board[r].some(cell => cell !== null)) {
        this.isAlive = false;
        return;
      }
    }

    // Shift board up: remove from top of visible area, not buffer zone
    this.board.splice(0, lines);

    // Add garbage rows at bottom
    for (let i = 0; i < lines; i++) {
      const row = Array(BOARD_WIDTH).fill('garbage');
      row[gapColumn] = null;
      this.board.push(row);
    }

    // Check if current piece now collides (rare edge case)
    if (this.currentPiece && this._checkCollision(this.currentPiece)) {
      // Try to push piece up
      while (this._checkCollision(this.currentPiece) && this.currentPiece.row > 0) {
        this.currentPiece.row--;
      }
      if (this._checkCollision(this.currentPiece)) {
        this.isAlive = false;
      }
    }
  }

  // --- Ghost Piece ---

  getGhostY() {
    if (!this.currentPiece) return 0;

    let ghostRow = this.currentPiece.row;
    const testPiece = { ...this.currentPiece };

    while (true) {
      testPiece.row = ghostRow + 1;
      if (this._checkCollision(testPiece)) break;
      ghostRow++;
    }

    return ghostRow;
  }

  // --- Next Queue ---

  getNextQueue() {
    return this.pieceGenerator.peek(NEXT_PREVIEW_COUNT);
  }

  // --- State Serialization ---

  getState() {
    return {
      board: this.board.map(row => [...row]),
      currentPiece: this.currentPiece ? { ...this.currentPiece } : null,
      holdPiece: this.holdPiece,
      holdUsed: this.holdUsed,
      ghostY: this.getGhostY(),
      nextQueue: this.getNextQueue(),
      score: this.score,
      linesCleared: this.linesCleared,
      startingLevel: this.startingLevel,
      level: this.level,
      combo: this.combo,
      backToBack: this.backToBack,
      isAlive: this.isAlive,
      piecesPlaced: this.piecesPlaced,
      gravityTimer: this.gravityTimer,
      softDropping: this.softDropping,
      lockDelayMs: this.lockDelayMs,
      lockTimer: this.lockTimer,
      lockResets: this.lockResets,
      isOnGround: this.isOnGround,
      lastAction: this.lastAction,
      lastKickIndex: this.lastKickIndex,
      lastAttackResult: this.lastAttackResult ? {
        ...this.lastAttackResult,
        clearedRows: [...(this.lastAttackResult.clearedRows || [])]
      } : null,
      generatorState: this.pieceGenerator.getState()
    };
  }

  loadState(state = {}) {
    this.board = Array.isArray(state.board)
      ? state.board.map(row => [...row])
      : Array.from({ length: TOTAL_ROWS }, () => Array(BOARD_WIDTH).fill(null));

    this.currentPiece = state.currentPiece ? { ...state.currentPiece } : null;
    this.holdPiece = state.holdPiece ?? null;
    this.holdUsed = Boolean(state.holdUsed);

    this.score = state.score ?? 0;
    this.linesCleared = state.linesCleared ?? 0;
    this.startingLevel = state.startingLevel ?? this.startingLevel ?? 1;
    this.level = state.level ?? this.startingLevel;
    this.combo = state.combo ?? -1;
    this.backToBack = state.backToBack ?? -1;
    this.isAlive = state.isAlive ?? true;
    this.piecesPlaced = state.piecesPlaced ?? 0;

    this.gravityTimer = state.gravityTimer ?? 0;
    this.softDropping = Boolean(state.softDropping);

    this.lockDelayMs = Math.max(LOCK_DELAY, state.lockDelayMs ?? LOCK_DELAY);
    this.lockTimer = state.lockTimer ?? 0;
    this.lockResets = state.lockResets ?? 0;
    this.isOnGround = state.isOnGround ?? (this.currentPiece ? this._isOnGround() : false);

    this.lastAction = state.lastAction ?? null;
    this.lastKickIndex = state.lastKickIndex ?? 0;
    this.lastAttackResult = state.lastAttackResult ? {
      ...state.lastAttackResult,
      clearedRows: [...(state.lastAttackResult.clearedRows || [])]
    } : null;

    this.pieceGenerator.loadState(state.generatorState);
  }

  getVisibleBoard() {
    // Return only visible rows (skip buffer zone)
    return this.board.slice(BUFFER_ZONE).map(row => [...row]);
  }

  getBoardSnapshot() {
    return {
      board: this.getVisibleBoard(),
      currentPiece: this.currentPiece ? {
        ...this.currentPiece,
        row: this.currentPiece.row - BUFFER_ZONE
      } : null,
      ghostY: this.currentPiece ? this.getGhostY() - BUFFER_ZONE : 0,
      holdPiece: this.holdPiece,
      nextQueue: this.getNextQueue(),
      score: this.score,
      linesCleared: this.linesCleared,
      level: this.level,
      isAlive: this.isAlive
    };
  }
}
