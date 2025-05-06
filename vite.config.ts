import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    outDir: './dist',
    target: 'esnext'
  },
  server: {
    port: 3000,
  },
});

