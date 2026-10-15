import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,       // same port as CRA so muscle memory still works
    open: true,       // auto-open browser on npm start
  },
  build: {
    outDir: 'build',  // match CRA's output folder name
  },
});
