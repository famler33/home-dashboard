import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, __BUILD_ID__: 'readonly' } },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      ...reactHooks.configs.recommended.rules,
      // No hard-coded UI strings: texts come from the German dictionary.
      'react/jsx-no-literals': ['error', { noStrings: false, allowedStrings: [] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal',
          message: 'Use a dictionary text (t(...)) instead of a hard-coded string.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['src/**'],
    rules: { 'react/jsx-no-literals': 'off' },
  },
);
