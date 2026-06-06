import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind solo incluye los estilos de los archivos listados aquí → bundle mínimo
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Define tu paleta de colores corporativos aquí para usarlos como: text-brand-500
      colors: {
        brand: {
          50: "#f0fdf4",
          500: "#22c55e",
          900: "#14532d",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
