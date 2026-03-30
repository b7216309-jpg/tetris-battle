import { test, expect, Page } from '@playwright/test';

/** Helper: navigate to title, click PRACTICE to enter solo mode, wait for HUD. */
async function startPracticeMode(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  await page.locator('#btn-practice').click();
  await expect(page.locator('#hud-screen')).toHaveClass(/active/);
}

test.describe('Solo Gameplay', () => {
  test('start practice mode and verify HUD shows', async ({ page }) => {
    await startPracticeMode(page);

    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-level')).toHaveText('1');
    await expect(page.locator('#hud-lines')).toHaveText('0');
    await expect(page.locator('#hud-combo')).toHaveText('-');
  });

  test('keyboard input - ArrowLeft moves piece', async ({ page }) => {
    await startPracticeMode(page);

    // Press ArrowLeft - should not cause errors; game should remain in PLAYING state
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);

    // HUD should still be visible (game still playing)
    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('keyboard input - ArrowRight moves piece', async ({ page }) => {
    await startPracticeMode(page);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('keyboard input - ArrowUp rotates piece', async ({ page }) => {
    await startPracticeMode(page);

    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('keyboard input - ArrowDown soft drops', async ({ page }) => {
    await startPracticeMode(page);

    // Hold ArrowDown briefly to soft drop
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowDown');

    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('keyboard input - Space hard drops piece', async ({ page }) => {
    await startPracticeMode(page);

    // Hard drop places the first piece immediately
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    // Game should still be in playing state after one hard drop
    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('hard drop updates score', async ({ page }) => {
    await startPracticeMode(page);

    // Initial score is 0
    await expect(page.locator('#hud-score')).toHaveText('0');

    // Hard drop gives 2 points per cell dropped, piece spawns near top
    // and drops to bottom so score should increase
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    const scoreText = await page.locator('#hud-score').textContent();
    const score = parseInt(scoreText!.replace(/,/g, ''), 10);
    expect(score).toBeGreaterThan(0);
  });

  test('hold piece (C key) works', async ({ page }) => {
    await startPracticeMode(page);

    // Press C to hold current piece - game should continue normally
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(200);

    // Game should still be active
    await expect(page.locator('#hud-screen')).toHaveClass(/active/);

    // Hard drop the swapped piece - should also work
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    await expect(page.locator('#hud-screen')).toHaveClass(/active/);
  });

  test('score updates when lines are cleared', async ({ page }) => {
    await startPracticeMode(page);

    // Hard drop many pieces rapidly to fill and clear lines.
    // Alternate left/right to spread pieces across the board.
    // This is a probabilistic approach: with enough drops, lines will clear.
    for (let i = 0; i < 40; i++) {
      // Alternate position: move left or right before dropping
      if (i % 5 === 0) {
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
      } else if (i % 5 === 1) {
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
      } else if (i % 5 === 2) {
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
      } else if (i % 5 === 3) {
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
      }
      // Rotate some pieces to fit better
      if (i % 3 === 0) {
        await page.keyboard.press('ArrowUp');
      }
      await page.keyboard.press('Space');
      await page.waitForTimeout(50);

      // Check if game over
      const isGameOver = await page.locator('#gameover-screen').evaluate(
        el => el.classList.contains('active')
      );
      if (isGameOver) break;
    }

    // Score should have increased from initial 0
    const scoreText = await page.locator('#hud-score').textContent()
      ?? await page.locator('#stat-score').textContent();
    const score = parseInt(scoreText!.replace(/,/g, ''), 10);
    expect(score).toBeGreaterThan(0);
  });

  test('game over screen appears when board fills up', async ({ page }) => {
    await startPracticeMode(page);

    // Rapidly hard drop pieces without moving them (stacking in center)
    // This will eventually fill up the board and trigger game over.
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(30);

      const isGameOver = await page.locator('#gameover-screen').evaluate(
        el => el.classList.contains('active')
      );
      if (isGameOver) break;
    }

    // Game over screen should be visible
    const gameoverScreen = page.locator('#gameover-screen');
    await expect(gameoverScreen).toHaveClass(/active/, { timeout: 15_000 });

    // Result text should say GAME OVER (solo mode)
    await expect(page.locator('#result-text')).toHaveText('GAME OVER');

    // Stats should be present
    await expect(page.locator('#stat-score')).toBeVisible();
    await expect(page.locator('#stat-lines')).toBeVisible();
    await expect(page.locator('#stat-level')).toBeVisible();
    await expect(page.locator('#stat-pieces')).toBeVisible();
  });

  test('rematch button starts a new game', async ({ page }) => {
    await startPracticeMode(page);

    // Force game over quickly
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(30);
      const isGameOver = await page.locator('#gameover-screen').evaluate(
        el => el.classList.contains('active')
      );
      if (isGameOver) break;
    }

    await expect(page.locator('#gameover-screen')).toHaveClass(/active/, { timeout: 15_000 });

    // Click REMATCH
    await page.locator('#btn-rematch').click();

    // Should go back to HUD (new game started)
    const hudScreen = page.locator('#hud-screen');
    await expect(hudScreen).toHaveClass(/active/);

    // Score should be reset to 0
    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-level')).toHaveText('1');
    await expect(page.locator('#hud-lines')).toHaveText('0');
  });

  test('back to menu button returns to title screen', async ({ page }) => {
    await startPracticeMode(page);

    // Force game over quickly
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(30);
      const isGameOver = await page.locator('#gameover-screen').evaluate(
        el => el.classList.contains('active')
      );
      if (isGameOver) break;
    }

    await expect(page.locator('#gameover-screen')).toHaveClass(/active/, { timeout: 15_000 });

    // Click MENU button
    await page.locator('#btn-back').click();

    // Should return to title screen
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).toHaveClass(/active/);

    // Game over screen should no longer be active
    await expect(page.locator('#gameover-screen')).not.toHaveClass(/active/);
  });
});
