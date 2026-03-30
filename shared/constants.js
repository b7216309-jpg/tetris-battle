// Board dimensions
export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const BUFFER_ZONE = 4; // Hidden rows above visible area
export const TOTAL_ROWS = BOARD_HEIGHT + BUFFER_ZONE;

// Timing (ms)
export const DEFAULT_GRAVITY = 1000; // ms per cell at level 1
export const SOFT_DROP_FACTOR = 5;   // gravity multiplier when soft dropping
export const LOCK_DELAY = 500;       // ms before piece locks on ground
export const MAX_LOCK_RESETS = 15;   // max move/rotate resets of lock timer

// Input (ms)
export const DAS = 133;  // Delayed Auto Shift
export const ARR = 10;   // Auto Repeat Rate

// Battle
export const GARBAGE_DELAY = 333; // ms before garbage appears
export const SERVER_TICK_RATE = 60;
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

// Exploit bonuses
export const BONUS_IRON_WELL_LINES = 8;
export const BONUS_BLACKOUT_DURATION_MS = 5000;
export const BONUS_PHASE_SHIFT_DURATION_MS = 5000;
export const BONUS_LOCK_DELAY_BOOST_MS = 250;
export const BONUS_GARBAGE_DELAY_BOOST_MS = 700;

// Attack table: clearType -> garbage lines sent
export const ATTACK_TABLE = {
  single: 0,
  double: 1,
  triple: 2,
  tetris: 4,
  tSpinMini: 0,
  tSpinMiniSingle: 0,
  tSpinMiniDouble: 1,
  tSpin: 0,
  tSpinSingle: 2,
  tSpinDouble: 4,
  tSpinTriple: 6,
  perfectClear: 10
};

// Combo bonus table (index = combo count)
export const COMBO_TABLE = [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];

// Back-to-back bonus
export const B2B_BONUS = 1;

// Gravity speed per level (ms per cell)
export function getGravityForLevel(level) {
  // Standard Tetris guideline gravity curve
  const baseFrames = Math.pow(0.8 - ((level - 1) * 0.007), level - 1) * 60;
  return Math.max((baseFrames / 60) * 1000, 16.67); // min ~1 frame
}

// Scoring
export const SCORE_TABLE = {
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
  tSpinMini: 100,
  tSpinMiniSingle: 200,
  tSpinMiniDouble: 400,
  tSpin: 400,
  tSpinSingle: 800,
  tSpinDouble: 1200,
  tSpinTriple: 1600,
  perfectClear: 3000,
  softDrop: 1,  // per cell
  hardDrop: 2   // per cell
};

// Lines per level
export const LINES_PER_LEVEL = 10;

// Piece types
export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Next queue preview count
export const NEXT_PREVIEW_COUNT = 5;

// Room system
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/1/O/0

export const DEFAULT_ROOM_OPTIONS = {
  startingLevel: 1,
  garbageDelay: 'normal',
  bonusesEnabled: true,
  speedCurve: 'normal',
  linesToWin: 0
};

export const GARBAGE_DELAY_VALUES = {
  short: 200,
  normal: 333,
  long: 500
};
