const prettierPlugin = require('eslint-plugin-prettier');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['types/**', 'artifacts/**', 'cache/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
