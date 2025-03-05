const stylePlugin = require("esbuild-style-plugin");

module.exports = stylePlugin({
  postcss: {
    plugins: [require("@tailwindcss/postcss"), require("autoprefixer")],
  },
});
