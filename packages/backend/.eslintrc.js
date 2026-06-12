module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/eslint-recommended',
    '@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',

    // Import rules
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

    // Stylistic rules (can be customized)
    '@typescript-eslint/indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],

    // Possible problems
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};