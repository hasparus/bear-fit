// @ts-check

import eslint from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tseslint from "typescript-eslint";
import tailwindPlugin from "@hasparus/eslint-plugin-tailwindcss";
import perfectionistPlugin from "eslint-plugin-perfectionist";

export default tseslint.config(
  {
    plugins: {
      "@hasparus/eslint-plugin-tailwindcss": fixupPluginRules(tailwindPlugin),
    },
  },
  {
    extends: perfectionistPlugin.configs["recommended-natural"],
    rules: {
      "perfectionist/sort-classes": [
        "error",
        {
          order: "asc",
          partitionByComment: true,
          type: "natural",
        },
      ],
      "perfectionist/sort-enums": "off",
      "perfectionist/sort-objects": [
        "error",
        {
          order: "asc",
          partitionByComment: true,
          type: "natural",
        },
      ],
      "perfectionist/sort-union-types": [
        "error",
        {
          order: "asc",
          groups: ["unknown", "keyword", "nullish"],
          type: "natural",
        },
      ],
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic
);
