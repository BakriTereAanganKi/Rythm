import { cpSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * public/tanpura-full is a symlink to media/tanpura-full (~200 MB of full-length tanpura recordings).
 * The dev server serves it directly; builds copy public/ *without* it, and `npm run apk` hard-links the
 * recordings into the Android app — so the big files never get duplicated on disk.
 */
function publicWithoutMedia(): Plugin {
  return {
    name: 'public-without-media',
    apply: 'build',
    closeBundle() {
      for (const f of readdirSync('public')) if (f !== 'tanpura-full') cpSync(`public/${f}`, `dist/${f}`, { recursive: true });
    },
  };
}

export default defineConfig({ plugins: [react(), publicWithoutMedia()], build: { copyPublicDir: false } });
