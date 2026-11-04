import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'supabase/functions/_shared'), '@': path.resolve(__dirname, 'src') } },
  // ffmpeg.wasm ships its own worker; pre-bundling breaks it.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely: separate files stay in the browser cache across our deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
