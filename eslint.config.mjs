import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "release/**",
      "node_modules/**",
      "docs/**",
      "scripts/**",
      "*.config.js",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "electron.vite.config.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
