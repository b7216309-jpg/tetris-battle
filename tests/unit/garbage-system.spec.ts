import { test, expect } from '@playwright/test';

/*
 * Unit tests for GarbageSystem.
 *
 * Runs inside the browser page so Vite can resolve
 * the @tetris/shared workspace alias.
 */

test.describe('GarbageSystem - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  });

  // ------- Queue Garbage -------

  test('queueGarbage adds pending garbage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(4, 1000);
      return {
        pendingCount: gs.pendingGarbage.length,
        firstLines: gs.pendingGarbage[0].lines,
        firstTimestamp: gs.pendingGarbage[0].timestamp,
        gapInRange: gs.pendingGarbage[0].gapColumn >= 0 && gs.pendingGarbage[0].gapColumn < 10,
      };
    });
    expect(result.pendingCount).toBe(1);
    expect(result.firstLines).toBe(4);
    expect(result.firstTimestamp).toBe(1000);
    expect(result.gapInRange).toBe(true);
  });

  test('queueGarbage respects forced gap column and delay override', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(3, 1500, { gapColumn: 6, delayMs: 950 });
      return gs.pendingGarbage[0];
    });

    expect(result.lines).toBe(3);
    expect(result.timestamp).toBe(1500);
    expect(result.gapColumn).toBe(6);
    expect(result.delayMs).toBe(950);
  });

  test('queueGarbage with zero lines does nothing', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(0, 1000);
      return gs.pendingGarbage.length;
    });
    expect(result).toBe(0);
  });

  test('queueGarbage with negative lines does nothing', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(-3, 1000);
      return gs.pendingGarbage.length;
    });
    expect(result).toBe(0);
  });

  test('multiple queueGarbage calls accumulate', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(2, 1000);
      gs.queueGarbage(3, 1100);
      gs.queueGarbage(1, 1200);
      return {
        pendingCount: gs.pendingGarbage.length,
        totalLines: gs.getPendingLines(),
      };
    });
    expect(result.pendingCount).toBe(3);
    expect(result.totalLines).toBe(6);
  });

  // ------- Process Garbage (Delay) -------

  test('processGarbage returns nothing before delay expires', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const { GARBAGE_DELAY } = await import('@tetris/shared');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(4, 1000);

      // Process before delay (GARBAGE_DELAY = 333ms)
      const ready = gs.processGarbage(1000 + GARBAGE_DELAY - 1);
      return {
        readyCount: ready.length,
        stillPending: gs.pendingGarbage.length,
        GARBAGE_DELAY,
      };
    });
    expect(result.readyCount).toBe(0);
    expect(result.stillPending).toBe(1);
  });

  test('processGarbage returns garbage after delay expires', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const { GARBAGE_DELAY } = await import('@tetris/shared');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(4, 1000);

      // Process after delay
      const ready = gs.processGarbage(1000 + GARBAGE_DELAY);
      return {
        readyCount: ready.length,
        readyLines: ready[0]?.lines,
        stillPending: gs.pendingGarbage.length,
      };
    });
    expect(result.readyCount).toBe(1);
    expect(result.readyLines).toBe(4);
    expect(result.stillPending).toBe(0);
  });

  test('processGarbage waits for per-batch custom delay', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);

      gs.queueGarbage(2, 1000, { delayMs: 900 });

      const early = gs.processGarbage(1899);
      const late = gs.processGarbage(1900);

      return {
        earlyCount: early.length,
        lateCount: late.length,
        lateLines: late[0]?.lines,
        pendingAfter: gs.pendingGarbage.length
      };
    });

    expect(result.earlyCount).toBe(0);
    expect(result.lateCount).toBe(1);
    expect(result.lateLines).toBe(2);
    expect(result.pendingAfter).toBe(0);
  });

  test('processGarbage handles mixed ready/not-ready items', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const { GARBAGE_DELAY } = await import('@tetris/shared');
      const gs = new GarbageSystem(42);

      gs.queueGarbage(2, 1000);  // will be ready at 1333
      gs.queueGarbage(3, 1200);  // will be ready at 1533
      gs.queueGarbage(1, 1400);  // will be ready at 1733

      // At time 1350: only the first should be ready
      const ready = gs.processGarbage(1350);
      return {
        readyCount: ready.length,
        readyLines: ready.map((g: any) => g.lines),
        remainingCount: gs.pendingGarbage.length,
        remainingLines: gs.getPendingLines(),
      };
    });
    expect(result.readyCount).toBe(1);
    expect(result.readyLines).toEqual([2]);
    expect(result.remainingCount).toBe(2);
    expect(result.remainingLines).toBe(4); // 3 + 1
  });

  test('processGarbage removes ready items from pending', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const { GARBAGE_DELAY } = await import('@tetris/shared');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(4, 1000);

      const pendingBefore = gs.getPendingLines();
      gs.processGarbage(1000 + GARBAGE_DELAY);
      const pendingAfter = gs.getPendingLines();

      return { pendingBefore, pendingAfter };
    });
    expect(result.pendingBefore).toBe(4);
    expect(result.pendingAfter).toBe(0);
  });

  // ------- Offset Garbage (Cancellation) -------

  test('offsetGarbage cancels pending garbage fully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(3, 1000);

      // Attack with 5 lines: 3 cancel garbage, 2 go to opponent
      const remaining = gs.offsetGarbage(5);
      return {
        remaining,
        pendingLines: gs.getPendingLines(),
        pendingCount: gs.pendingGarbage.length,
      };
    });
    expect(result.remaining).toBe(2); // 5 - 3 = 2 to send
    expect(result.pendingLines).toBe(0);
    expect(result.pendingCount).toBe(0);
  });

  test('offsetGarbage partially cancels garbage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(5, 1000);

      // Attack with 3 lines: cancels 3 of the 5, leaving 2
      const remaining = gs.offsetGarbage(3);
      return {
        remaining,
        pendingLines: gs.getPendingLines(),
      };
    });
    expect(result.remaining).toBe(0); // all attack lines consumed
    expect(result.pendingLines).toBe(2); // 5 - 3 = 2 still pending
  });

  test('offsetGarbage cancels across multiple pending entries', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(2, 1000);
      gs.queueGarbage(3, 1100);
      gs.queueGarbage(4, 1200);

      // Attack with 4 lines: cancels 2 (first) + 2 of 3 (second)
      const remaining = gs.offsetGarbage(4);
      return {
        remaining,
        pendingLines: gs.getPendingLines(),
        pendingCount: gs.pendingGarbage.length,
      };
    });
    expect(result.remaining).toBe(0); // all attack consumed
    expect(result.pendingLines).toBe(5); // 1 + 4 remain
    expect(result.pendingCount).toBe(2); // first entry fully consumed
  });

  test('offsetGarbage with zero attack lines does nothing', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(3, 1000);

      const remaining = gs.offsetGarbage(0);
      return {
        remaining,
        pendingLines: gs.getPendingLines(),
      };
    });
    expect(result.remaining).toBe(0);
    expect(result.pendingLines).toBe(3);
  });

  test('offsetGarbage with no pending garbage returns all attack lines', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      // No garbage queued
      const remaining = gs.offsetGarbage(4);
      return remaining;
    });
    expect(result).toBe(4);
  });

  test('offsetGarbage exact cancellation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(4, 1000);

      const remaining = gs.offsetGarbage(4);
      return {
        remaining,
        pendingLines: gs.getPendingLines(),
        pendingCount: gs.pendingGarbage.length,
      };
    });
    expect(result.remaining).toBe(0);
    expect(result.pendingLines).toBe(0);
    expect(result.pendingCount).toBe(0);
  });

  // ------- Pending Lines Calculation -------

  test('getPendingLines returns total pending garbage lines', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(2, 1000);
      gs.queueGarbage(3, 1100);
      gs.queueGarbage(5, 1200);
      return gs.getPendingLines();
    });
    expect(result).toBe(10);
  });

  test('getPendingLines returns 0 when no garbage is queued', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      return gs.getPendingLines();
    });
    expect(result).toBe(0);
  });

  // ------- Clear -------

  test('clear removes all pending garbage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs = new GarbageSystem(42);
      gs.queueGarbage(3, 1000);
      gs.queueGarbage(2, 1100);

      const before = gs.getPendingLines();
      gs.clear();
      const after = gs.getPendingLines();

      return { before, after, count: gs.pendingGarbage.length };
    });
    expect(result.before).toBe(5);
    expect(result.after).toBe(0);
    expect(result.count).toBe(0);
  });

  // ------- Gap Column -------

  test('gap column is within board width range', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const { BOARD_WIDTH } = await import('@tetris/shared');
      const gs = new GarbageSystem(42);

      const gaps: number[] = [];
      for (let i = 0; i < 20; i++) {
        gs.queueGarbage(1, 1000 + i * 100);
      }
      for (const g of gs.pendingGarbage) {
        gaps.push(g.gapColumn);
      }
      return { gaps, boardWidth: BOARD_WIDTH };
    });

    for (const gap of result.gaps) {
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThan(result.boardWidth);
    }
  });

  test('same seed produces same gap columns', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { GarbageSystem } = await import('@server/game/GarbageSystem.js');
      const gs1 = new GarbageSystem(42);
      const gs2 = new GarbageSystem(42);

      for (let i = 0; i < 5; i++) {
        gs1.queueGarbage(1, 1000 + i * 100);
        gs2.queueGarbage(1, 1000 + i * 100);
      }

      const gaps1 = gs1.pendingGarbage.map((g: any) => g.gapColumn);
      const gaps2 = gs2.pendingGarbage.map((g: any) => g.gapColumn);

      return { gaps1, gaps2 };
    });
    expect(result.gaps1).toEqual(result.gaps2);
  });
});
