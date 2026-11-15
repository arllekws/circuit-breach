import { defineConfig } from 'vitest/config';

// base relativa: o jogo funciona em qualquer caminho do GitHub Pages
// (https://usuario.github.io/<nome-do-repo>/), sem depender do nome do repositório.
export default defineConfig({
  base: './',
  test: {
    environment: 'node',
    include: ['testes/**/*.test.ts'],
  },
});
