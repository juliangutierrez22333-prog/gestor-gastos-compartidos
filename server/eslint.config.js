import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Express 5 maneja las promesas rechazadas de los handlers async;
      // sin esta excepción la regla prohibiría pasarlos a router.get/post.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      // Convención: prefijo _ marca parámetros requeridos por una firma
      // pero no usados (ej. el _next obligatorio de los error handlers).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
