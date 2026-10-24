const { heroui } = require("@heroui/react");


/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
     "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  corePlugins: {
    // Astryx ships its own reset in the `reset` cascade layer. Tailwind's
    // preflight is unlayered, so it would override Astryx card borders and
    // padding with its global `border-width: 0` reset.
    preflight: false,
  },
  plugins: [heroui()],
}