/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px", // Full HD ultra-wide / desktop
      "4xl": "2560px", // 2K QHD
      "5xl": "3840px", // 4K UHD
    },
    extend: {
      colors: {
        background: "#09090b",
        surface: {
          50: "#18181b",
          100: "#121214",
          200: "#09090b",
          300: "#050507",
        },
        brand: {
          50: "#ecfdf5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
      },
      fontFamily: {
        sans: [
          '"Outfit"',
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          "Menlo",
          "monospace",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
