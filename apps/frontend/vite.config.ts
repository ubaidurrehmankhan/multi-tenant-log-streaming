import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// GOOD: Configure Vite with path aliases and proper port
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Needed for Docker
    strictPort: true,
    watch: {
      usePolling: true, // Needed for Docker on some systems
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
});
