/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ficsit: {
          50: "#fdf8e8",
          100: "#f9edc5",
          200: "#f4d98e",
          300: "#eec04d",
          400: "#e6a720",
          500: "#d68f13",
          600: "#ba6d0d",
          700: "#944e10",
          800: "#7b3e14",
          900: "#693517",
          950: "#3d1a09",
        },
      },
    },
  },
  plugins: [],
};
