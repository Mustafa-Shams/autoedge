/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  "#0D0F17",
          card:     "#161821",
          elevated: "#1E2130",
          border:   "#2A2D3E",
        },
        text: {
          primary:   "#E8EAF0",
          secondary: "#8B90A7",
          muted:     "#4A4F6A",
        },
        accent: {
          blue:      "#4D7FFF",
          blueHover: "#3D6FEF",
        },
        status: {
          available: "#22C55E",
          reserved:  "#F59E0B",
          sold:      "#8B5CF6",
          cancelled: "#EF4444",
          scheduled: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
