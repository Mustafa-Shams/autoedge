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
          muted:     "#9297AD",
        },
        accent: {
          // Text and outlines on dark surfaces; fills with white text use blue-strong (>= 6:1).
          blue:      "#7399FF",
          blueHover: "#3D6FEF",
          "blue-strong":       "#285BCF",
          "blue-strong-hover": "#214BA9",
        },
        status: {
          available: "#22C55E",
          reserved:  "#F59E0B",
          sold:      "#A78BFA",
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
