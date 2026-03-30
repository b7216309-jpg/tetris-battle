import { test, expect } from '@playwright/test';

test('two players can start an online match and play', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await Promise.all([
    page1.goto('/'),
    page2.goto('/')
  ]);

  await Promise.all([
    page1.waitForSelector('#ui-overlay', { timeout: 15_000 }),
    page2.waitForSelector('#ui-overlay', { timeout: 15_000 })
  ]);

  await Promise.all([
    page1.locator('#btn-play-online').click(),
    page2.locator('#btn-play-online').click()
  ]);

  await Promise.all([
    expect(page1.locator('#countdown-screen')).toHaveClass(/active/, { timeout: 15_000 }),
    expect(page2.locator('#countdown-screen')).toHaveClass(/active/, { timeout: 15_000 })
  ]);

  await Promise.all([
    expect(page1.locator('#hud-screen')).toHaveClass(/active/, { timeout: 15_000 }),
    expect(page2.locator('#hud-screen')).toHaveClass(/active/, { timeout: 15_000 })
  ]);

  await page1.keyboard.press('Space');
  await expect(page1.locator('#hud-score')).not.toHaveText('0', { timeout: 5_000 });

  await expect(page2.locator('#hud-screen')).toHaveClass(/active/);

  await Promise.all([
    ctx1.close(),
    ctx2.close()
  ]);
});
