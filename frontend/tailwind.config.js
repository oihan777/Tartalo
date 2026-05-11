/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tartalo earthy palette
        bark: {
          50: "#f5efe6",
          100: "#ece2cf",
          200: "#d8c5a1",
          300: "#b89e6f",
          400: "#8c7045",
          500: "#5d4a2e",
          600: "#3f3220",
          700: "#2c2316",
          800: "#1d170e",
          900: "#100c07",
          950: "#070503",
        },
        moss: {
          50: "#f1f5ed",
          100: "#dee7d4",
          200: "#bccaa6",
          300: "#94a978",
          400: "#6e8451",
          500: "#536638",
          600: "#3e4f29",
          700: "#2d3a1d",
          800: "#1d2812",
          900: "#0f1608",
        },
        clay: {
          400: "#c08458",
          500: "#9a6033",
          600: "#714325",
        },
        ember: {
          400: "#d97842",
          500: "#b35a26",
        },
        parchment: "#efe3c8",
        ink: "#1b150c",
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        organic:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)",
        glow: "0 0 0 1px rgba(148, 169, 120, 0.25), 0 8px 32px -8px rgba(148, 169, 120, 0.2)",
      },
      backgroundImage: {
        bark: "radial-gradient(ellipse at top, rgba(140,112,69,0.18), transparent 60%), linear-gradient(180deg, #1d170e 0%, #100c07 100%)",
        parchment:
          "radial-gradient(ellipse at top, rgba(217,120,66,0.06), transparent 70%), linear-gradient(180deg, #161108 0%, #0a0805 100%)",
      },
      keyframes: {
        irisPulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.95" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        glance: {
          "0%, 90%, 100%": { transform: "translate(0,0)" },
          "40%": { transform: "translate(1.5px,0)" },
          "60%": { transform: "translate(-1.5px,0)" },
        },
      },
      animation: {
        iris: "irisPulse 4.5s ease-in-out infinite",
        glance: "glance 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
