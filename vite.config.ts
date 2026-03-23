import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

function injectEnvIntoHtml(): import('vite').Plugin {
  return {
    name: 'inject-env-into-html',
    transformIndexHtml(html) {
      return html.replace(/%VITE_(\w+)%/g, (_, key) => {
        return process.env[`VITE_${key}`] ?? '';
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), injectEnvIntoHtml()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
