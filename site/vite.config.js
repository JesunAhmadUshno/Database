import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The site reads ../scott.sql, ../all_queries.sql and the notebook outputs (via scripts/extract.mjs)
// at build time, so every number on the page is parsed or computed, never typed.
export default defineConfig({
  base: '/Database/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
