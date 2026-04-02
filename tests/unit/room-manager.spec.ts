import { test, expect } from '@playwright/test';

test.describe('RoomManager - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  });

  test('partial option updates preserve an existing bonus toggle', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RoomManager } = await import('@server/matchmaking/RoomManager.js');
      const manager = new RoomManager({});

      const merged = manager._validateOptions(
        { garbageDelay: 'short' },
        {
          startingLevel: 4,
          garbageDelay: 'normal',
          bonusesEnabled: false,
          speedCurve: 'fast',
          linesToWin: 40
        }
      );

      clearInterval(manager._cleanupInterval);
      return merged;
    });

    expect(result.garbageDelay).toBe('short');
    expect(result.bonusesEnabled).toBe(false);
    expect(result.startingLevel).toBe(4);
    expect(result.speedCurve).toBe('fast');
    expect(result.linesToWin).toBe(40);
  });
});
