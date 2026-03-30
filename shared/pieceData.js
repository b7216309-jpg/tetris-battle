// SRS Tetromino shapes - each piece has 4 rotation states
// Coordinates are [col, row] offsets from the piece center
// Row increases downward, col increases rightward

export const PIECE_SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],  // State 0
    [[2, 0], [2, 1], [2, 2], [2, 3]],  // State R
    [[0, 2], [1, 2], [2, 2], [3, 2]],  // State 2
    [[1, 0], [1, 1], [1, 2], [1, 3]]   // State L
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],  // State 0
    [[1, 0], [2, 0], [1, 1], [2, 1]],  // State R
    [[1, 0], [2, 0], [1, 1], [2, 1]],  // State 2
    [[1, 0], [2, 0], [1, 1], [2, 1]]   // State L
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],  // State 0
    [[1, 0], [1, 1], [2, 1], [1, 2]],  // State R
    [[0, 1], [1, 1], [2, 1], [1, 2]],  // State 2
    [[1, 0], [0, 1], [1, 1], [1, 2]]   // State L
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],  // State 0
    [[1, 0], [1, 1], [2, 1], [2, 2]],  // State R
    [[1, 1], [2, 1], [0, 2], [1, 2]],  // State 2
    [[0, 0], [0, 1], [1, 1], [1, 2]]   // State L
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],  // State 0
    [[2, 0], [1, 1], [2, 1], [1, 2]],  // State R
    [[0, 1], [1, 1], [1, 2], [2, 2]],  // State 2
    [[1, 0], [0, 1], [1, 1], [0, 2]]   // State L
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],  // State 0
    [[1, 0], [2, 0], [1, 1], [1, 2]],  // State R
    [[0, 1], [1, 1], [2, 1], [2, 2]],  // State 2
    [[1, 0], [1, 1], [0, 2], [1, 2]]   // State L
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],  // State 0
    [[1, 0], [1, 1], [1, 2], [2, 2]],  // State R
    [[0, 1], [1, 1], [2, 1], [0, 2]],  // State 2
    [[0, 0], [1, 0], [1, 1], [1, 2]]   // State L
  ]
};

// SRS Wall Kick Data
// Format: [fromState][toState] = array of 5 [dx, dy] offsets to test
// dy positive = down (matching row convention)

// Wall kicks for J, L, S, T, Z pieces
export const WALL_KICK_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],   // 0 -> R
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],      // R -> 0
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],      // R -> 2
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],    // 2 -> R
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],       // 2 -> L
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],   // L -> 2
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],   // L -> 0
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],       // 0 -> L
  // 180-degree rotation kicks
  '0>2': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
  '1>3': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
  '2>0': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
  '3>1': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]]
};

// Wall kicks for I piece (separate table with larger offsets)
export const WALL_KICK_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  // 180-degree rotation kicks
  '0>2': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '1>3': [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  '2>0': [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]],
  '3>1': [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
};

// Piece colors (hex)
export const PIECE_COLORS = {
  I: 0x00f0f0, // Cyan
  O: 0xf0f000, // Yellow
  T: 0xa000f0, // Purple
  S: 0x00f000, // Green
  Z: 0xf00000, // Red
  J: 0x0000f0, // Blue
  L: 0xf0a000, // Orange
  garbage: 0x808080 // Gray
};

// Piece spawn position (col offset from left, row near top of visible area)
// Standard guideline: pieces spawn so they are partially visible at the top
export const PIECE_SPAWN = {
  col: 3, // Left edge of 4-wide bounding box at column 3 (0-indexed)
  row: 2  // Top of bounding box at row 2, cells at rows 2-3 (just above visible)
};

// T-Spin corner positions relative to T piece center (at rotation state's center block)
// Used for the 3-corner T-spin detection rule
export const T_CORNERS = [
  [0, 0],   // top-left
  [2, 0],   // top-right
  [0, 2],   // bottom-left
  [2, 2]    // bottom-right
];

// T piece "front" corners per rotation state (the two corners the T points toward)
// Used to distinguish full T-spin from T-spin mini
export const T_FRONT_CORNERS = {
  0: [[0, 0], [2, 0]],   // pointing up: top-left, top-right
  1: [[2, 0], [2, 2]],   // pointing right: top-right, bottom-right
  2: [[0, 2], [2, 2]],   // pointing down: bottom-left, bottom-right
  3: [[0, 0], [0, 2]]    // pointing left: top-left, bottom-left
};
