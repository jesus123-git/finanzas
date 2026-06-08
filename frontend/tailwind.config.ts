import type { Config } from 'tailwindcss';

const config: Config = {
  // ─── Dark mode via class strategy ────────────────────────────────────────────
  // next-themes inyecta la clase 'dark' en <html> cuando el usuario elige noche.
  // Tailwind genera las clases dark:* solo cuando darkMode = 'class'.
  darkMode: 'class',

  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          900: '#14532d',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        // Toast deslizando desde la derecha
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        // Drawer lateral deslizando desde la derecha (Calendario / detalles)
        'drawer-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        // Fade + escala suave para modales
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'slide-in':  'slide-in 0.25s ease-out',
        'drawer-in': 'drawer-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up':   'fade-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
