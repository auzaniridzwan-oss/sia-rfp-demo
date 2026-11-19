import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Local API: `pnpm dev:api` (scripts/dev-api.ts) on :3000. The header tells it which
    // site is calling, matching how each Vercel project binds its entity.
    proxy: { '/api': { target: 'http://127.0.0.1:3000', headers: { 'x-sia-entity': 'TR' } } },
  },
});
