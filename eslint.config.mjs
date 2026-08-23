import antfu from '@antfu/eslint-config'

export default antfu(
  {
    react: true,
    typescript: true,
    javascript: true,
  },
  {
    ignores: [
      'build/',
      'node_modules/',
      '.plasmo/',
      'src/components/ui/',
      'pnpm-lock.yaml',
    ],
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },
  {
    rules: {
      'default-case': 'error',
      'no-unsafe-finally': 'error',
      'no-trailing-spaces': 'warn',
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-types': 'off',
      'no-html-link-for-pages': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-console': 'off',
    },
  },
)
