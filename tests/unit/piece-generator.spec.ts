import { test, expect } from '@playwright/test';

/*
 * Unit tests for PieceGenerator.
 *
 * Like the TetrisEngine tests, these run inside the browser page
 * so that Vite resolves the @tetris/shared workspace alias.
 */

test.describe('PieceGenerator - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  });

  // ------- 7-Bag Randomizer -------

  test('first bag contains all 7 piece types exactly once', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);
      const pieces: string[] = [];
      for (let i = 0; i < 7; i++) {
        pieces.push(gen.next());
      }
      return pieces;
    });

    expect(result).toHaveLength(7);
    const sorted = [...result].sort();
    expect(sorted).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  });

  test('second bag also contains all 7 piece types exactly once', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);
      // Consume first bag
      for (let i = 0; i < 7; i++) gen.next();
      // Collect second bag
      const pieces: string[] = [];
      for (let i = 0; i < 7; i++) {
        pieces.push(gen.next());
      }
      return pieces;
    });

    expect(result).toHaveLength(7);
    const sorted = [...result].sort();
    expect(sorted).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  });

  test('multiple bags each contain all 7 types', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(123);
      const bags: string[][] = [];
      for (let b = 0; b < 5; b++) {
        const bag: string[] = [];
        for (let i = 0; i < 7; i++) {
          bag.push(gen.next());
        }
        bags.push(bag);
      }
      return bags;
    });

    for (const bag of result) {
      expect(bag).toHaveLength(7);
      const sorted = [...bag].sort();
      expect(sorted).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    }
  });

  // ------- Deterministic Seeding -------

  test('same seed produces same sequence', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen1 = new PieceGenerator(42);
      const gen2 = new PieceGenerator(42);

      const seq1: string[] = [];
      const seq2: string[] = [];
      for (let i = 0; i < 21; i++) { // 3 bags worth
        seq1.push(gen1.next());
        seq2.push(gen2.next());
      }
      return { seq1, seq2 };
    });

    expect(result.seq1).toEqual(result.seq2);
  });

  test('different seeds produce different sequences', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen1 = new PieceGenerator(42);
      const gen2 = new PieceGenerator(9999);

      const seq1: string[] = [];
      const seq2: string[] = [];
      for (let i = 0; i < 14; i++) { // 2 bags
        seq1.push(gen1.next());
        seq2.push(gen2.next());
      }
      return { seq1, seq2 };
    });

    // The sequences should differ (extremely unlikely to match with different seeds)
    expect(result.seq1).not.toEqual(result.seq2);
  });

  // ------- Peek -------

  test('peek returns correct number of upcoming pieces', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);
      const peeked = gen.peek(5);
      return { count: peeked.length, pieces: peeked };
    });

    expect(result.count).toBe(5);
    // All peeked items should be valid piece types
    for (const p of result.pieces) {
      expect(['I', 'O', 'T', 'S', 'Z', 'J', 'L']).toContain(p);
    }
  });

  test('peek does not consume pieces', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);
      const peeked1 = gen.peek(5);
      const peeked2 = gen.peek(5);
      const nextPiece = gen.next();
      return { peeked1, peeked2, nextPiece };
    });

    // Two consecutive peeks should return the same result
    expect(result.peeked1).toEqual(result.peeked2);
    // The first piece from next() should match the first peeked piece
    expect(result.nextPiece).toBe(result.peeked1[0]);
  });

  test('peek after consuming some pieces reflects the updated queue', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);

      const peekBefore = gen.peek(5);
      const consumed = gen.next(); // remove first
      const peekAfter = gen.peek(5);

      return { peekBefore, consumed, peekAfter };
    });

    // After consuming one, the peeked queue should shift
    expect(result.consumed).toBe(result.peekBefore[0]);
    expect(result.peekAfter[0]).toBe(result.peekBefore[1]);
    expect(result.peekAfter[1]).toBe(result.peekBefore[2]);
    expect(result.peekAfter[2]).toBe(result.peekBefore[3]);
    expect(result.peekAfter[3]).toBe(result.peekBefore[4]);
  });

  // ------- Bag Refill -------

  test('bag refills seamlessly after depletion', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);

      // Draw 14 pieces (2 full bags) and make sure no errors
      const pieces: string[] = [];
      for (let i = 0; i < 14; i++) {
        pieces.push(gen.next());
      }
      return pieces;
    });

    expect(result).toHaveLength(14);
    // Each group of 7 should contain all types
    const firstBag = result.slice(0, 7).sort();
    const secondBag = result.slice(7, 14).sort();
    expect(firstBag).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    expect(secondBag).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  });

  test('peek spans across bag boundary', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);

      // Consume 5 pieces (leaving 2 in current bag)
      for (let i = 0; i < 5; i++) gen.next();

      // Peek 5 -- should span 2 from current bag + 3 from next bag
      const peeked = gen.peek(5);

      // Verify by consuming and comparing
      const consumed: string[] = [];
      for (let i = 0; i < 5; i++) consumed.push(gen.next());

      return { peeked, consumed };
    });

    expect(result.peeked).toEqual(result.consumed);
  });

  test('large peek returns up to available pieces', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PieceGenerator } = await import('@server/game/PieceGenerator.js');
      const gen = new PieceGenerator(42);

      // Peek more than 2 bags (14 pieces)
      const peeked = gen.peek(20);
      return { count: peeked.length };
    });

    // peek looks at bag + nextBag combined = up to 14
    expect(result.count).toBeLessThanOrEqual(14);
    expect(result.count).toBeGreaterThanOrEqual(7);
  });
});
