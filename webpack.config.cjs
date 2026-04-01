const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = [
  {
    name: "chrome",
    mode: "development",
    devtool: "source-map",
    entry: {
      "content/content": "./src/content/content.js",
      "options/options": "./src/options/options.js",
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist/chrome"),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "src/manifest-chrome.json",
            to: "manifest.json",
          },
          { from: "src/content/inject.js", to: "content/inject.js" },
          { from: "src/options/options.html", to: "options/options.html" },
          { from: "src/options/options.css", to: "options/options.css" },
        ],
      }),
    ],
  },
  {
    name: "firefox",
    mode: "development",
    devtool: "source-map",
    entry: {
      "content/content": "./src/content/content.js",
      "options/options": "./src/options/options.js",
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist/firefox"),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "src/manifest-firefox.json",
            to: "manifest.json",
          },
          { from: "src/content/inject.js", to: "content/inject.js" },
          { from: "src/options/options.html", to: "options/options.html" },
          { from: "src/options/options.css", to: "options/options.css" },
        ],
      }),
    ],
  },
];
