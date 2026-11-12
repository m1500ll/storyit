/** @type {import('tailwindcss').Config} */

// Theme-aware colours are CSS variables holding "R G B" channels (see src/index.css),
// so opacity modifiers like `bg-ink-950/80` keep working in both themes.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix, keys) => Object.fromEntries(keys.map((k) => [k, v(`${prefix}-${k}`)]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces: page → card → input → raised
        ink: scale('ink', [950, 900, 850, 800, 700, 600]),
        // Text greys (50 = strongest). 900 stays fixed: used on always-white surfaces.
        zinc: { ...scale('zinc', [50, 100, 200, 300, 400, 500, 600]), 900: '#18181b' },
        // Hairlines and tints: white on dark, deep ink on light.
        line: v('line'),
        violet: { 200: v('violet-200'), 300: v('violet-300'), 400: v('violet-400'), 500: '#8b5cf6', 600: '#7c3aed' },
        coral: { 300: v('coral-300'), 400: v('coral-400'), 500: '#f4715f' },
        emerald: { 200: v('emerald-200'), 300: v('emerald-300'), 400: '#34d399', 500: '#10b981' },
        amber: { 100: v('amber-100'), 200: v('amber-200'), 300: v('amber-300'), 400: '#fbbf24', 500: '#f59e0b' },
        sky: { 300: v('sky-300'), 500: '#0ea5e9' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // headings and big numbers: a bold modern grotesque (src/main.tsx loads it)
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        hero: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { glow: '0 0 40px -10px rgba(139,92,246,0.45)' },
    },
  },
  plugins: [],
};
