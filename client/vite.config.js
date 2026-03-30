import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    topLevelAwait()
  ],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@tetris/shared': path.resolve(__dirname, '../shared'),
      '@server': path.resolve(__dirname, '../server/src')
    }
  }
});
