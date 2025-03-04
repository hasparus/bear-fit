/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.tsx", "./app/**/*.css"],
  plugins: [],
  theme: {
    extend: {
      colors: {
        // disable palettes, so we use just neutral
        gray: "gray",
        slate: "slate",
        stone: "stone",
      },
    },
    fontFamily: {
      mono: ["Inconsolata", "Menlo", "Chicago", "Geneva"],
      sans: [
        "Chicago",
        "ui-sans-serif",
        "system-ui",
        "sans-serif",
        "Apple Color Emoji",
        "Segoe UI Emoji",
        "Segoe UI Symbol",
        "Noto Color Emoji",
      ],
    },
  },
};
