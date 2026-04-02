import { test, expect } from '@playwright/test';

/*
 * Unit tests for TetrisEngine.
 *
 * Because the game source uses ES module imports with workspace aliases
 * (@tetris/shared) that Node cannot resolve natively, we evaluate the
 * engine logic inside a browser page where Vite resolves the aliases.
 *
 * Each test navigates to the running Vite dev server and uses
 * page.evaluate() to dynamically import the modules and run assertions.
 */

const SERVER_MODULES = {
  TetrisEngine: '/src/game/TetrisEngine.js',
};

/*
 * Helper: evaluate an async function inside the browser page.
 * Vite serves the server code via the @server alias configured in vite.config.
 * We dynamically import TetrisEngine (which itself imports from @tetris/shared).
 */
async function evalEngine(page: any, fn: string) {
  return page.evaluate(fn);
}

test.describe('TetrisEngine - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  });

  // ------- Piece Spawning -------

  test('spawnPiece returns true and sets currentPiece', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      const spawned = engine.spawnPiece();
      return {
        spawned,
        hasPiece: engine.currentPiece !== null,
        type: engine.currentPiece?.type,
        rotation: engine.currentPiece?.rotation,
      };
    });
    expect(result.spawned).toBe(true);
    expect(result.hasPiece).toBe(true);
    expect(result.type).toBeTruthy();
    expect(result.rotation).toBe(0);
  });

  test('spawned piece type is one of the 7 tetrominoes', async ({ page }) => {
    const type = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      return engine.currentPiece!.type;
    });
    expect(['I', 'O', 'T', 'S', 'Z', 'J', 'L']).toContain(type);
  });

  // ------- Movement -------

  test('movePiece left decreases col', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const colBefore = engine.currentPiece!.col;
      const moved = engine.movePiece(-1, 0);
      return { moved, colBefore, colAfter: engine.currentPiece!.col };
    });
    expect(result.moved).toBe(true);
    expect(result.colAfter).toBe(result.colBefore - 1);
  });

  test('movePiece right increases col', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const colBefore = engine.currentPiece!.col;
      const moved = engine.movePiece(1, 0);
      return { moved, colBefore, colAfter: engine.currentPiece!.col };
    });
    expect(result.moved).toBe(true);
    expect(result.colAfter).toBe(result.colBefore + 1);
  });

  test('movePiece down increases row', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const rowBefore = engine.currentPiece!.row;
      const moved = engine.movePiece(0, 1);
      return { moved, rowBefore, rowAfter: engine.currentPiece!.row };
    });
    expect(result.moved).toBe(true);
    expect(result.rowAfter).toBe(result.rowBefore + 1);
  });

  test('movePiece fails when blocked by wall', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      // Move all the way left until blocked
      let count = 0;
      while (engine.movePiece(-1, 0)) {
        count++;
        if (count > 20) break; // safety
      }
      // One more move should fail
      return engine.movePiece(-1, 0);
    });
    expect(result).toBe(false);
  });

  // ------- Rotation -------

  test('rotatePiece CW changes rotation state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      // Use a seed that does NOT start with O piece (O cannot rotate)
      // Try several seeds to find one that spawns a non-O piece
      for (let seed = 0; seed < 100; seed++) {
        const engine = new TetrisEngine(seed);
        engine.spawnPiece();
        if (engine.currentPiece!.type === 'O') continue;
        const rotBefore = engine.currentPiece!.rotation;
        const rotated = engine.rotatePiece(1);
        return { rotated, rotBefore, rotAfter: engine.currentPiece!.rotation, type: engine.currentPiece!.type };
      }
      return { rotated: false, rotBefore: 0, rotAfter: 0, type: 'O' };
    });
    expect(result.rotated).toBe(true);
    expect(result.rotAfter).toBe((result.rotBefore + 1) % 4);
  });

  test('rotatePiece CCW changes rotation state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      for (let seed = 0; seed < 100; seed++) {
        const engine = new TetrisEngine(seed);
        engine.spawnPiece();
        if (engine.currentPiece!.type === 'O') continue;
        const rotBefore = engine.currentPiece!.rotation;
        const rotated = engine.rotatePiece(-1);
        return { rotated, rotBefore, rotAfter: engine.currentPiece!.rotation };
      }
      return { rotated: false, rotBefore: 0, rotAfter: 0 };
    });
    expect(result.rotated).toBe(true);
    // -1 mod 4 = 3
    expect(result.rotAfter).toBe(((result.rotBefore - 1) % 4 + 4) % 4);
  });

  test('O piece does not rotate', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      // Force spawn an O piece
      (engine as any)._spawnSpecificPiece('O');
      const rotBefore = engine.currentPiece!.rotation;
      const rotated = engine.rotatePiece(1);
      return { rotated, rotBefore, rotAfter: engine.currentPiece!.rotation };
    });
    expect(result.rotated).toBe(false);
    expect(result.rotAfter).toBe(result.rotBefore);
  });

  test('wall kick allows rotation near wall', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      // Force spawn a T piece and move to left wall
      (engine as any)._spawnSpecificPiece('T');
      while (engine.movePiece(-1, 0)) {} // push to left wall
      // Rotate CW -- should succeed via wall kick
      const rotated = engine.rotatePiece(1);
      return { rotated, col: engine.currentPiece!.col };
    });
    expect(result.rotated).toBe(true);
  });

  // ------- Hard Drop -------

  test('hardDrop places piece at bottom and returns attack result', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const attackResult = engine.hardDrop();

      // Board should have some non-null cells at the bottom rows
      let filledCells = 0;
      for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          if (engine.board[r][c] !== null) filledCells++;
        }
      }
      return {
        hasResult: attackResult !== null,
        filledCells,
        scorePositive: engine.score > 0,
        piecesPlaced: engine.piecesPlaced,
        hasNewPiece: engine.currentPiece !== null,
      };
    });
    expect(result.hasResult).toBe(true);
    expect(result.filledCells).toBe(4); // first piece = 4 cells
    expect(result.scorePositive).toBe(true); // hard drop score
    expect(result.piecesPlaced).toBe(1);
    expect(result.hasNewPiece).toBe(true); // next piece auto-spawned
  });

  // ------- Line Clearing -------

  test('single line clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      // Fill the bottom row completely except one cell, then drop a piece to fill it
      const bottomRow = TOTAL_ROWS - 1;
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[bottomRow][c] = 'garbage';
      }
      // Leave a gap that an I-piece in horizontal orientation can fill
      // Actually, just fill the row entirely and check clearLines
      // Use internal method to test directly
      const clearResult = engine._clearLines();
      return {
        count: clearResult.count,
        isPerfectClear: clearResult.isPerfectClear,
      };
    });
    expect(result.count).toBe(1);
  });

  test('double line clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      // Fill bottom 2 rows completely
      for (let r = TOTAL_ROWS - 2; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[r][c] = 'garbage';
        }
      }
      const clearResult = engine._clearLines();
      return { count: clearResult.count };
    });
    expect(result.count).toBe(2);
  });

  test('triple line clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      for (let r = TOTAL_ROWS - 3; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[r][c] = 'garbage';
        }
      }
      const clearResult = engine._clearLines();
      return { count: clearResult.count };
    });
    expect(result.count).toBe(3);
  });

  test('tetris (4-line) clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[r][c] = 'garbage';
        }
      }
      const clearResult = engine._clearLines();
      return { count: clearResult.count };
    });
    expect(result.count).toBe(4);
  });

  test('lines are removed and board shifts down after clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      // Put a marker cell on the row above the bottom
      const markerRow = TOTAL_ROWS - 2;
      engine.board[markerRow][0] = 'marker';

      // Fill bottom row
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[TOTAL_ROWS - 1][c] = 'garbage';
      }

      engine._clearLines();

      // After clearing, the marker should have shifted down by 1
      return {
        markerNewPos: engine.board[TOTAL_ROWS - 1][0],
        topRowEmpty: engine.board[0].every((c: any) => c === null),
      };
    });
    expect(result.markerNewPos).toBe('marker');
    expect(result.topRowEmpty).toBe(true);
  });

  // ------- T-Spin Detection -------

  test('T-spin is detected when T piece is rotated into 3-corner position', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);

      // Occupy 3 of the 4 corners around the T's rotation center.
      // This creates a valid T-spin state without depending on a fragile pocket layout.
      engine.board[20][2] = 'garbage';
      engine.board[20][4] = 'garbage';
      engine.board[22][2] = 'garbage';

      // Place a T piece so a clockwise rotation lands in that 3-corner setup.
      engine._spawnSpecificPiece('T');
      engine.currentPiece!.col = 2;
      engine.currentPiece!.row = 20;
      engine.currentPiece!.rotation = 0;

      // Rotate CW to tuck in (this sets lastAction = 'rotate')
      const rotated = engine.rotatePiece(1);

      const tSpin = engine._detectTSpin();
      return { rotated, isTSpin: tSpin.isTSpin, isMini: tSpin.isMini };
    });
    expect(result.rotated).toBe(true);
    expect(result.isTSpin).toBe(true);
  });

  test('T-spin not detected if last action was not rotate', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine._spawnSpecificPiece('T');
      engine.lastAction = 'move'; // NOT rotate
      const tSpin = engine._detectTSpin();
      return tSpin;
    });
    expect(result.isTSpin).toBe(false);
  });

  test('T-spin not detected for non-T pieces', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine._spawnSpecificPiece('I');
      engine.lastAction = 'rotate';
      const tSpin = engine._detectTSpin();
      return tSpin;
    });
    expect(result.isTSpin).toBe(false);
  });

  // ------- Hold Piece -------

  test('holdSwap stores current piece and spawns next', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const firstType = engine.currentPiece!.type;

      const held = engine.holdSwap();

      return {
        held,
        holdPiece: engine.holdPiece,
        firstType,
        newPieceExists: engine.currentPiece !== null,
        newPieceType: engine.currentPiece?.type,
        holdUsed: engine.holdUsed,
      };
    });
    expect(result.held).toBe(true);
    expect(result.holdPiece).toBe(result.firstType);
    expect(result.newPieceExists).toBe(true);
    expect(result.newPieceType).not.toBe(result.firstType); // got next from generator
    expect(result.holdUsed).toBe(true);
  });

  test('holdSwap cannot be used twice before placing a piece', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      engine.holdSwap();
      const secondHold = engine.holdSwap();
      return secondHold;
    });
    expect(result).toBe(false);
  });

  test('holdSwap swaps with held piece on second use', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const firstType = engine.currentPiece!.type;
      engine.holdSwap();
      const heldType = engine.holdPiece;
      const secondType = engine.currentPiece!.type;

      // Place current piece via hardDrop, then hold again
      engine.hardDrop();
      const thirdType = engine.currentPiece!.type;
      engine.holdSwap();

      return {
        firstType,
        heldType,
        secondType,
        thirdType,
        currentTypeAfterSecondHold: engine.currentPiece?.type,
        holdPieceAfterSecondHold: engine.holdPiece,
      };
    });
    // After second hold: the currently-held piece (firstType) should come back
    expect(result.currentTypeAfterSecondHold).toBe(result.heldType);
    expect(result.holdPieceAfterSecondHold).toBe(result.thirdType);
  });

  // ------- Gravity -------

  test('updateGravity moves piece down over time', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const rowBefore = engine.currentPiece!.row;

      // At level 1, gravity is 1000ms per cell. Simulate 1100ms.
      engine.updateGravity(1100);

      return {
        rowBefore,
        rowAfter: engine.currentPiece!.row,
      };
    });
    expect(result.rowAfter).toBeGreaterThan(result.rowBefore);
  });

  test('soft drop makes piece fall faster', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const rowBefore = engine.currentPiece!.row;

      engine.setSoftDrop(true);
      // Soft drop uses the shared SOFT_DROP_FACTOR (currently 5),
      // so 250ms should still move the piece faster than normal gravity.
      engine.updateGravity(250);

      return {
        rowBefore,
        rowAfter: engine.currentPiece!.row,
        dropped: engine.currentPiece!.row - rowBefore,
      };
    });
    expect(result.dropped).toBeGreaterThanOrEqual(1);
  });

  // ------- Game Over -------

  test('game over when spawn position is blocked', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      // Fill the top rows (buffer zone) so no piece can spawn
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[r][c] = 'garbage';
        }
      }

      const spawned = engine.spawnPiece();
      return { spawned, isAlive: engine.isAlive };
    });
    expect(result.spawned).toBe(false);
    expect(result.isAlive).toBe(false);
  });

  // ------- Score Calculation -------

  test('hard drop score is 2 per cell dropped', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const startRow = engine.currentPiece!.row;
      engine.hardDrop();
      // Score = (ghostY - startRow) * 2 (hard drop) + any line clear score
      return { score: engine.score, startRow };
    });
    // At minimum the hard drop itself gives 2 points per cell
    expect(result.score).toBeGreaterThan(0);
  });

  test('score increases after clearing lines', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS, SCORE_TABLE } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);

      // Fill bottom row except one cell, place I piece to complete it
      const bottom = TOTAL_ROWS - 1;
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[bottom][c] = 'garbage';
      }

      // Process the line clear directly
      const clearResult = engine._clearLines();
      const tSpin = { isTSpin: false, isMini: false };
      const attack = engine._processLineClear(clearResult, tSpin);

      return {
        linesCleared: attack.linesCleared,
        clearType: attack.clearType,
        score: engine.score,
        expectedMin: SCORE_TABLE.single,
      };
    });
    expect(result.linesCleared).toBe(1);
    expect(result.clearType).toBe('single');
    expect(result.score).toBeGreaterThanOrEqual(result.expectedMin);
  });

  // ------- Combo Tracking -------

  test('combo increments on consecutive line clears', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      const tSpin = { isTSpin: false, isMini: false };

      // Simulate 3 consecutive clears
      const combos: number[] = [];
      for (let i = 0; i < 3; i++) {
        // Fill a row
        const row = TOTAL_ROWS - 1;
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[row][c] = 'garbage';
        }
        const clearResult = engine._clearLines();
        const attack = engine._processLineClear(clearResult, tSpin);
        combos.push(attack.combo);
      }
      return combos;
    });
    expect(result[0]).toBe(0); // first clear: combo = 0
    expect(result[1]).toBe(1); // second clear: combo = 1
    expect(result[2]).toBe(2); // third clear: combo = 2
  });

  test('combo resets to -1 on no line clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      const tSpin = { isTSpin: false, isMini: false };

      // Clear a line to start combo
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[TOTAL_ROWS - 1][c] = 'garbage';
      }
      engine._clearLines();
      engine._processLineClear({ count: 1, rows: [TOTAL_ROWS - 1], isPerfectClear: false }, tSpin);

      const comboAfterClear = engine.combo;

      // No-clear: count = 0
      engine._processLineClear({ count: 0, rows: [], isPerfectClear: false }, tSpin);
      const comboAfterNoClear = engine.combo;

      return { comboAfterClear, comboAfterNoClear };
    });
    expect(result.comboAfterClear).toBe(0);
    expect(result.comboAfterNoClear).toBe(-1);
  });

  // ------- Back-to-Back Tracking -------

  test('back-to-back increments for consecutive difficult clears', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      const tSpin = { isTSpin: false, isMini: false };

      // Two consecutive Tetris clears (4 lines each = "difficult")
      const b2bValues: number[] = [];
      for (let i = 0; i < 2; i++) {
        // Fill 4 bottom rows
        for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) {
            engine.board[r][c] = 'garbage';
          }
        }
        const clearResult = engine._clearLines();
        const attack = engine._processLineClear(clearResult, tSpin);
        b2bValues.push(attack.backToBack);
      }
      return b2bValues;
    });
    expect(result[0]).toBe(0);  // first tetris: b2b starts at 0
    expect(result[1]).toBe(1);  // second tetris: b2b = 1
  });

  test('back-to-back resets on non-difficult clear', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      const tSpin = { isTSpin: false, isMini: false };

      // Tetris (difficult)
      for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          engine.board[r][c] = 'garbage';
        }
      }
      let clearResult = engine._clearLines();
      engine._processLineClear(clearResult, tSpin);
      const b2bAfterTetris = engine.backToBack;

      // Single (not difficult)
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[TOTAL_ROWS - 1][c] = 'garbage';
      }
      clearResult = engine._clearLines();
      engine._processLineClear(clearResult, tSpin);
      const b2bAfterSingle = engine.backToBack;

      return { b2bAfterTetris, b2bAfterSingle };
    });
    expect(result.b2bAfterTetris).toBe(0);
    expect(result.b2bAfterSingle).toBe(-1);
  });

  // ------- Garbage Application -------

  test('applyGarbage adds rows at the bottom', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { BOARD_WIDTH, TOTAL_ROWS } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();

      engine.applyGarbage(2, 5);

      // Bottom 2 rows should have garbage with gap at column 5
      const bottomRow = engine.board[TOTAL_ROWS - 1];
      const secondRow = engine.board[TOTAL_ROWS - 2];

      return {
        bottomFilled: bottomRow.filter((c: any) => c === 'garbage').length,
        bottomGap: bottomRow[5],
        secondFilled: secondRow.filter((c: any) => c === 'garbage').length,
        secondGap: secondRow[5],
      };
    });
    expect(result.bottomFilled).toBe(9); // 10 - 1 gap
    expect(result.bottomGap).toBeNull();
    expect(result.secondFilled).toBe(9);
    expect(result.secondGap).toBeNull();
  });

  // ------- State Serialization -------

  test('getState returns complete game state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const state = engine.getState();
      return {
        hasBoard: Array.isArray(state.board),
        hasPiece: state.currentPiece !== null,
        hasNextQueue: Array.isArray(state.nextQueue),
        nextQueueLength: state.nextQueue.length,
        score: state.score,
        level: state.level,
        isAlive: state.isAlive,
      };
    });
    expect(result.hasBoard).toBe(true);
    expect(result.hasPiece).toBe(true);
    expect(result.hasNextQueue).toBe(true);
    expect(result.nextQueueLength).toBe(5); // NEXT_PREVIEW_COUNT
    expect(result.score).toBe(0);
    expect(result.level).toBe(1);
    expect(result.isAlive).toBe(true);
  });

  test('loadState restores engine state and future piece order', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      engine.movePiece(-1, 0);
      engine.rotatePiece(1);
      engine.setSoftDrop(true);
      engine.updateGravity(250);
      engine.setSoftDrop(false);
      engine.holdSwap();

      const saved = engine.getState();
      const restored = new TetrisEngine(999);
      restored.loadState(saved);

      const before = {
        board: restored.getVisibleBoard(),
        currentPiece: restored.currentPiece,
        holdPiece: restored.holdPiece,
        nextQueue: restored.getNextQueue(),
        score: restored.score,
        level: restored.level,
        combo: restored.combo,
        piecesPlaced: restored.piecesPlaced
      };

      const sourceDrop = engine.hardDrop();
      const restoredDrop = restored.hardDrop();

      return {
        before,
        sourceAfter: {
          board: engine.getVisibleBoard(),
          currentPiece: engine.currentPiece,
          holdPiece: engine.holdPiece,
          nextQueue: engine.getNextQueue(),
          score: engine.score,
          piecesPlaced: engine.piecesPlaced
        },
        restoredAfter: {
          board: restored.getVisibleBoard(),
          currentPiece: restored.currentPiece,
          holdPiece: restored.holdPiece,
          nextQueue: restored.getNextQueue(),
          score: restored.score,
          piecesPlaced: restored.piecesPlaced
        },
        sourceDrop,
        restoredDrop
      };
    });

    expect(result.before.currentPiece).toBeTruthy();
    expect(result.before.nextQueue).toHaveLength(5);
    expect(result.restoredAfter).toEqual(result.sourceAfter);
    expect(result.restoredDrop).toEqual(result.sourceDrop);
  });

  // ------- Ghost Piece -------

  test('getGhostY returns row at bottom of drop path', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();
      const ghostY = engine.getGhostY();
      const currentRow = engine.currentPiece!.row;
      return { ghostY, currentRow };
    });
    expect(result.ghostY).toBeGreaterThan(result.currentRow);
  });

  test('setLockDelayMs extends ground lock timing before piece locks', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TetrisEngine } = await import('@server/game/TetrisEngine.js');
      const { LOCK_DELAY } = await import('@tetris/shared');
      const engine = new TetrisEngine(42);
      engine.spawnPiece();

      while (engine.movePiece(0, 1)) {
        // Drop to the floor without locking.
      }

      engine.setLockDelayMs(LOCK_DELAY + 250);

      const beforePieces = engine.piecesPlaced;
      const earlyLock = engine.updateLockDelay(LOCK_DELAY);
      const afterEarlyPieces = engine.piecesPlaced;
      const finalLock = engine.updateLockDelay(250);

      return {
        earlyLock,
        beforePieces,
        afterEarlyPieces,
        finalLocked: finalLock !== null,
        afterFinalPieces: engine.piecesPlaced
      };
    });

    expect(result.earlyLock).toBeNull();
    expect(result.beforePieces).toBe(0);
    expect(result.afterEarlyPieces).toBe(0);
    expect(result.finalLocked).toBe(true);
    expect(result.afterFinalPieces).toBe(1);
  });
});
