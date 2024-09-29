// @ts-check

import eslint from "@eslint/js";
import tailwindPlugin from "@hasparus/eslint-plugin-tailwindcss";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tailwindPlugin.configs["flat/recommended"],
  {
    extends: [perfectionistPlugin.configs["recommended-natural"]],
    rules: {
      "perfectionist/sort-classes": [
        "warn",
        {
          order: "asc",
          partitionByComment: true,
          type: "natural",
        },
      ],
      "perfectionist/sort-enums": "off",
      "perfectionist/sort-objects": [
        "warn",
        {
          order: "asc",
          partitionByComment: true,
          type: "natural",
        },
      ],
      "perfectionist/sort-union-types": [
        "warn",
        {
          groups: ["unknown", "keyword", "nullish"],
          order: "asc",
          type: "natural",
        },
      ],
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  }
);
