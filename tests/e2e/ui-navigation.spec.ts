import { test, expect } from '@playwright/test';

test.describe('UI Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the UI overlay to be injected by the app
    await page.waitForSelector('#ui-overlay', { timeout: 15_000 });
  });

  test('title screen is visible on load', async ({ page }) => {
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).toHaveClass(/active/);
    await expect(titleScreen).toBeVisible();
  });

  test('"TETRIS" and "BATTLE" text are visible', async ({ page }) => {
    const title = page.locator('#title-screen .title');
    const subtitle = page.locator('#title-screen .subtitle');

    await expect(title).toBeVisible();
    await expect(title).toHaveText('TETRIS');

    await expect(subtitle).toBeVisible();
    await expect(subtitle).toHaveText('BATTLE');
  });

  test('PLAY ONLINE and PRACTICE buttons are visible', async ({ page }) => {
    const playOnlineBtn = page.locator('#btn-play-online');
    const practiceBtn = page.locator('#btn-practice');

    await expect(playOnlineBtn).toBeVisible();
    await expect(playOnlineBtn).toHaveText('PLAY ONLINE');

    await expect(practiceBtn).toBeVisible();
    await expect(practiceBtn).toHaveText('PRACTICE');
  });

  test('click PRACTICE starts solo game and shows HUD', async ({ page }) => {
    const practiceBtn = page.locator('#btn-practice');
    await practiceBtn.click();

    // Title screen should disappear
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).not.toHaveClass(/active/);

    // HUD screen should be visible
    const hudScreen = page.locator('#hud-screen');
    await expect(hudScreen).toHaveClass(/active/);

    // HUD elements should be visible with initial values
    await expect(page.locator('#hud-score')).toBeVisible();
    await expect(page.locator('#hud-level')).toBeVisible();
    await expect(page.locator('#hud-lines')).toBeVisible();
    await expect(page.locator('#hud-combo')).toBeVisible();

    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-level')).toHaveText('1');
    await expect(page.locator('#hud-lines')).toHaveText('0');
  });

  test('click PLAY ONLINE shows lobby screen', async ({ page }) => {
    const playOnlineBtn = page.locator('#btn-play-online');
    await playOnlineBtn.click();

    // Title screen should disappear
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).not.toHaveClass(/active/);

    // Lobby screen should be visible
    const lobbyScreen = page.locator('#lobby-screen');
    await expect(lobbyScreen).toHaveClass(/active/);

    // Lobby elements should be present
    await expect(page.locator('#lobby-screen .spinner')).toBeVisible();
    await expect(page.locator('#lobby-screen .lobby-text')).toHaveText('SEARCHING FOR OPPONENT...');
    await expect(page.locator('#btn-cancel')).toBeVisible();
    await expect(page.locator('#btn-cancel')).toHaveText('CANCEL');
  });

  test('click CANCEL on lobby returns to title screen', async ({ page }) => {
    // Go to lobby first
    await page.locator('#btn-play-online').click();
    const lobbyScreen = page.locator('#lobby-screen');
    await expect(lobbyScreen).toHaveClass(/active/);

    // Click CANCEL
    await page.locator('#btn-cancel').click();

    // Should return to the title screen
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).toHaveClass(/active/);

    // Lobby should no longer be active
    await expect(lobbyScreen).not.toHaveClass(/active/);
  });

  test('screens transition correctly - only one screen active at a time', async ({ page }) => {
    // Initially only title is active
    const screens = page.locator('.screen');
    const titleScreen = page.locator('#title-screen');
    const lobbyScreen = page.locator('#lobby-screen');
    const hudScreen = page.locator('#hud-screen');

    // Count active screens -- should be exactly 1
    await expect(titleScreen).toHaveClass(/active/);
    const activeCountBefore = await screens.evaluateAll(
      els => els.filter(el => el.classList.contains('active')).length
    );
    expect(activeCountBefore).toBe(1);

    // Navigate to lobby
    await page.locator('#btn-play-online').click();
    await expect(lobbyScreen).toHaveClass(/active/);

    const activeCountLobby = await screens.evaluateAll(
      els => els.filter(el => el.classList.contains('active')).length
    );
    expect(activeCountLobby).toBe(1);

    // Go back to title
    await page.locator('#btn-cancel').click();
    await expect(titleScreen).toHaveClass(/active/);

    const activeCountBack = await screens.evaluateAll(
      els => els.filter(el => el.classList.contains('active')).length
    );
    expect(activeCountBack).toBe(1);

    // Navigate to practice/HUD
    await page.locator('#btn-practice').click();
    await expect(hudScreen).toHaveClass(/active/);

    const activeCountHud = await screens.evaluateAll(
      els => els.filter(el => el.classList.contains('active')).length
    );
    expect(activeCountHud).toBe(1);
  });
});
