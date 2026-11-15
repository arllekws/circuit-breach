import { describe, expect, it } from 'vitest';
import { avaliar } from '../../src/logica/avaliar';
import {
  bicondicional,
  e,
  implica,
  nao,
  ou,
  prop,
  xor,
  type Bit,
  type Formula,
} from '../../src/logica/tipos';

const P = prop('P');
const Q = prop('Q');

/** Confere um conectivo binário contra sua tabela-verdade, na ordem PQ = 00, 01, 10, 11. */
function confereTabela(formula: Formula, esperado: [boolean, boolean, boolean, boolean]) {
  const linhas: [Bit, Bit][] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  linhas.forEach(([p, q], i) => {
    expect(avaliar(formula, { P: p, Q: q }), `P=${p} Q=${q}`).toBe(esperado[i]);
  });
}

describe('avaliar — cada conectivo contra sua tabela-verdade', () => {
  it('VAR: vale o que a valoração atribui', () => {
    expect(avaliar(P, { P: 1 })).toBe(true);
    expect(avaliar(P, { P: 0 })).toBe(false);
  });

  it('NOT: 1 quando P é 0', () => {
    expect(avaliar(nao(P), { P: 0 })).toBe(true);
    expect(avaliar(nao(P), { P: 1 })).toBe(false);
  });

  it('AND: 1 só se P e Q forem 1', () => {
    confereTabela(e(P, Q), [false, false, false, true]);
  });

  it('OR: 1 se ao menos uma entrada for 1', () => {
    confereTabela(ou(P, Q), [false, true, true, true]);
  });

  it('XOR: 1 se exatamente uma entrada for 1', () => {
    confereTabela(xor(P, Q), [false, true, true, false]);
  });

  it('IMPLICA: 0 só quando P é 1 e Q é 0 (V -> F é F)', () => {
    confereTabela(implica(P, Q), [true, true, false, true]);
  });

  it('BICONDICIONAL: 1 quando P e Q são iguais', () => {
    confereTabela(bicondicional(P, Q), [true, false, false, true]);
  });
});

describe('avaliar — fórmulas compostas e erros', () => {
  it('avalia recursivamente, de dentro para fora: NOT P AND Q (fase 1-1)', () => {
    const porta = e(nao(P), Q);
    expect(avaliar(porta, { P: 1, Q: 0 })).toBe(false); // estado inicial: trancada
    expect(avaliar(porta, { P: 0, Q: 0 })).toBe(false); // desligou P: ainda trancada
    expect(avaliar(porta, { P: 0, Q: 1 })).toBe(true); // ligou Q: aberta
  });

  it('recusa valoração que não atribui valor a uma proposição da fórmula', () => {
    expect(() => avaliar(e(P, Q), { P: 1 })).toThrow(/Q/);
  });
});
