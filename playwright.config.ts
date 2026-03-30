import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-webgpu',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--use-gl=swiftshader',
            '--use-angle=swiftshader',
            '--use-vulkan=swiftshader',
            '--disable-gpu-sandbox',
            '--enable-webgpu-developer-features',
          ],
        },
      },
    },
  ],

  webServer: [
    {
      command: 'npm -w server run start',
      port: 3000,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm -w client run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      port: 5173,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
