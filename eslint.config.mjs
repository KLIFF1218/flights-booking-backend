import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  {
    ignores: ['dist', 'build', 'coverage', 'node_modules', '*.config.js', '*.config.mjs'],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,

  {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.node,
      ...globals.jest,
    },
    parserOptions: {
      project: ['./tsconfig.json'],
      tsconfigRootDir: __dirname,
    },
  },
},

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'lf',
        },
      ],
    },
  },

  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },

  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  {
    files: ['**/*.{spec,e2e-spec}.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
