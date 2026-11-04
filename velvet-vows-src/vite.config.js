import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: '/for-sarmistha/velvet-vows/', build: { outDir: '../velvet-vows', emptyOutDir: true } });
