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
        // Manrope: cuerpo — corporativa, cálida y muy legible
        sans:    ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        // Sora: titulares y marca — geométrica, elegante, innovadora
        display: ['var(--font-sora)', 'var(--font-manrope)', 'sans-serif'],
      },
      colors: {
        // ─── Identidad NOMI ────────────────────────────────────────────────
        // Base de marca #00796B (teal profundo): fresco, confiable, financiero.
        brand: {
          50:  '#e6f4f2',
          100: '#c2e4e0',
          200: '#8fcfc7',
          300: '#56b8ac',
          400: '#26a695',
          500: '#009688',
          600: '#00796B',   // ← color base de NOMI
          700: '#00695c',
          800: '#00564b',
          900: '#003d35',
          950: '#002b25',
        },
        // El módulo personal usaba 'emerald' en toda la app: remapeado a la
        // escala NOMI para re-vestir la interfaz completa sin tocar cada vista.
        emerald: {
          50:  '#e6f4f2',
          100: '#c2e4e0',
          200: '#8fcfc7',
          300: '#56b8ac',
          400: '#26a695',
          500: '#009688',
          600: '#00796B',
          700: '#00695c',
          800: '#00564b',
          900: '#003d35',
          950: '#002b25',
        },
        // Base monocroma: 'slate' (gris azulado) → grises neutros puros.
        // Light mode sobre blanco real, dark mode sobre negro real.
        slate: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e5e5e6',
          300: '#d4d4d6',
          400: '#a1a1a6',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0b0b0d',
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
