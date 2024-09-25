/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.tsx", "./app/**/*.css"],
  theme: {
    fontFamily: {
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
      mono: ["Inconsolata", "Menlo", "Chicago", "Geneva"],
    },
    extend: {
      colors: {
        // disable palettes, so we use just neutral
        gray: "gray",
        stone: "stone",
        slate: "slate",
      },
    },
  },
  plugins: [],
};
