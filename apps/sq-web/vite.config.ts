import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Serverless functions run under `vercel dev` (port 3000) from Phase 1 onwards.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
