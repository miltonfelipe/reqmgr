import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // './' makes all asset paths relative so build/index.html works
  // when opened directly from disk OR served from any subdirectory.
  // Change to '/' only if you deploy to a domain root via a web server.
  base: './',

  server: {
    port: 3000,
    open: true,
    // During development the API runs separately: uvicorn server.app:app --reload
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },

  build: {
    outDir: 'build',
  },
});
