import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Rewrite /lk/* to lk.html in dev mode (MPA support)
    {
      name: 'lk-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/lk')) {
            req.url = '/lk.html';
          }
          next();
        });
      },
    },
  ],
  base: '/',
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9502',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        lk: resolve(__dirname, 'lk.html'),
      },
    },
  },
});
