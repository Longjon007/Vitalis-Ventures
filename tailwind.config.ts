import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: '#0f0f1a',
          surface: '#1a1a2e',
          border: '#2a2a4a',
          accent: '#6c5ce7',
          'accent-hover': '#7c6cf7',
          text: '#e2e2f0',
          muted: '#8888aa',
          success: '#00b894',
          warning: '#fdcb6e',
          danger: '#e17055',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
