/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0a0a0c', 900: '#0f0f13', 850: '#14141a', 800: '#1a1a22', 700: '#25252f', 600: '#34343f' },
        violet: { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
        coral: { 300: '#fda4a4', 400: '#fb8a7a', 500: '#f4715f' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: { glow: '0 0 40px -10px rgba(139,92,246,0.45)' },
    },
  },
  plugins: [],
};
