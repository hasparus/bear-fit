// @ts-check

import eslint from "@eslint/js";
// TODO: ESLint plugin for Tailwind CSS is not compatible with Tailwind 4 yet
// import tailwindPlugin from "@hasparus/eslint-plugin-tailwindcss";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

const objectsOrderOptions = {
  type: "natural",
  groups: ["frontmatter", "unknown", "multiline"],
  order: "asc",
  partitionByComment: true,
  customGroups: [
    {
      elementNamePattern: "type|id",
      groupName: "frontmatter",
    },
  ],
};

export default tseslint.config(
  // ...tailwindPlugin.configs["flat/recommended"],
  {
    extends: [perfectionistPlugin.configs["recommended-natural"]],
    rules: {
      "perfectionist/sort-object-types": ["warn", objectsOrderOptions],
      "perfectionist/sort-union-types": [
        "warn",
        {
          type: "natural",
          groups: ["unknown", "keyword", "nullish"],
          order: "asc",
        },
      ],
      "perfectionist/sort-classes": "off",
      "perfectionist/sort-enums": "off",
      "perfectionist/sort-interfaces": ["warn", objectsOrderOptions],
      "perfectionist/sort-jsx-props": [
        "warn",
        (() => {
          const jsxOptions = { ...objectsOrderOptions };
          delete (
            /** @type {Partial<typeof jsxOptions>} */ (jsxOptions)
              .partitionByComment
          );
          return jsxOptions;
        })(),
      ],
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-named-imports": "warn",
      "perfectionist/sort-objects": ["warn", objectsOrderOptions],
      "perfectionist/sort-imports": [
        "warn",
        {
          internalPattern: ["^#.*"],
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
      // TypeScript checks this
      "no-undef": "off",
      // false positive on Promise.withResolvers
      "@typescript-eslint/no-invalid-void-type": "off",
    },
  },
  {
    files: ["*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
