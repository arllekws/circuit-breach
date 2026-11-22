import type { Estado } from './tipos';

// Tutorial integrado da fase 1-1. Não pausa o jogo nem muda regra: só observa o que o
// jogador fez (os eventos de `aplicar`) e marca cada passo como feito.

export const PASSOS = [
  'Mover o hacker',
  'Alternar um interruptor',
  'Ler os valores 0 e 1',
  'Observar o circuito',
  'Abrir o Scanner',
  'Chegar à saída',
] as const;

/** Passo feito (true) ou pendente (false), na ordem de PASSOS. */
export type Tutorial = readonly boolean[];

export function novoTutorial(): Tutorial {
  return PASSOS.map(() => false);
}

/**
 * Marca os passos cumpridos pela última ação:
 * 1. andar; 2. trocar um interruptor; 3. continuar jogando depois da primeira troca (já viu o
 * valor mudar); 4. trocar de novo (o circuito muda); 5. usar o Scanner; 6. vencer.
 */
export function avancarTutorial(tutorial: Tutorial, depois: Estado): Tutorial {
  const [, trocar, ler] = tutorial;
  const evento = depois.evento;
  const feito = [
    evento === 'andou',
    evento === 'troca',
    trocar === true && (evento === 'andou' || evento === 'troca'),
    ler === true && evento === 'troca',
    evento === 'scanner',
    evento === 'vitoria',
  ];
  return tutorial.map((jaFeito, i) => jaFeito || feito[i] === true);
}

/** Número (1 a 6) do primeiro passo pendente; 7 quando tudo foi feito. */
export function passoAtual(tutorial: Tutorial): number {
  const pendente = tutorial.indexOf(false);
  return pendente === -1 ? PASSOS.length + 1 : pendente + 1;
}
