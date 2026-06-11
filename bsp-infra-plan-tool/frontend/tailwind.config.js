/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vodafone: {
          50: "#fff0f0",
          100: "#ffe0e0",
          200: "#ffb8b8",
          500: "#e60000",
          600: "#e60000",
          700: "#cc0000",
          800: "#a30000",
          DEFAULT: "#e60000",
        },
        ziggo: {
          50: "#fff4eb",
          100: "#ffe8d6",
          200: "#ffc999",
          500: "#ff6600",
          600: "#ff6600",
          700: "#e55c00",
          800: "#bf4d00",
          DEFAULT: "#ff6600",
        },
        brand: {
          50: "#fff0f0",
          100: "#ffe0e0",
          500: "#e60000",
          600: "#e60000",
          700: "#cc0000",
        },
      },
      backgroundImage: {
        "vz-gradient": "linear-gradient(90deg, #e60000 0%, #ff6600 100%)",
        "vz-gradient-vertical": "linear-gradient(180deg, #e60000 0%, #ff6600 100%)",
      },
    },
  },
  plugins: [],
};
