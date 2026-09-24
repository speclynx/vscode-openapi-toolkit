import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error', // show Prettier issues as errors
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      '.vscode/**',
      '.vscode-test/**',
      'client/config/**',
      'client/scripts/**',
      'client/out/**',
      'client/dist/**',
      'client/src/preview/webview/**',
      'server/config/**',
      'server/scripts/**',
      'server/out/**',
      'server/dist/**',
      'server/src/test/fixtures/configuration/**',
      'server/src/test/configuration/**',
    ],
  },
);
