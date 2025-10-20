import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './public/index.html'
      }
    }
  },
  publicDir: 'public'
});