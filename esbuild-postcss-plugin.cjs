const stylePlugin = require("esbuild-style-plugin");

const postcssPlugin = stylePlugin({
  postcss: {
    plugins: [require("@tailwindcss/postcss"), require("autoprefixer")],
  },
});

// Wrap the style plugin to add an onResolve hook for static assets
// served from public/ — esbuild shouldn't try to bundle these
module.exports = {
  name: "postcss-with-static-assets",
  setup(build) {
    // Let /assets/* and /fonts/* resolve to themselves (served from public/)
    build.onResolve({ filter: /^\/(assets|fonts)\// }, (args) => ({
      path: args.path,
      external: true,
    }));

    // Delegate everything else to the style plugin
    postcssPlugin.setup(build);
  },
};
