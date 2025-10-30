// This file is here only for the Coverage GitHub Action.
// The coverage is actually coming from Playwright.
// I'll later fork the action to add an option to it,
// but first lemme test if it works.
module.exports = {
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
