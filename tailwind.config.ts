import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './app/**/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
} satisfies Config

// Note: Colors are now handled via CSS variables in globals.css using Tailwind v4 @theme


