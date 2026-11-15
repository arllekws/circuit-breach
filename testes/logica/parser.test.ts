import { describe, expect, it } from 'vitest';
import { analisar, ErroDeSintaxe } from '../../src/logica/parser';
import { bicondicional, e, implica, nao, ou, prop, xor } from '../../src/logica/tipos';

const P = prop('P');
const Q = prop('Q');
const R = prop('R');

describe('analisar — fórmulas básicas', () => {
  it('lê uma proposição', () => {
    expect(analisar('P')).toEqual(P);
  });

  it('lê cada conectivo', () => {
    expect(analisar('NOT P')).toEqual(nao(P));
    expect(analisar('P AND Q')).toEqual(e(P, Q));
    expect(analisar('P OR Q')).toEqual(ou(P, Q));
    expect(analisar('P XOR Q')).toEqual(xor(P, Q));
    expect(analisar('P -> Q')).toEqual(implica(P, Q));
    expect(analisar('P <-> Q')).toEqual(bicondicional(P, Q));
  });

  it('aceita os símbolos da lógica como sinônimos', () => {
    expect(analisar('¬P ∧ Q')).toEqual(analisar('NOT P AND Q'));
    expect(analisar('P ∨ Q')).toEqual(analisar('P OR Q'));
    expect(analisar('P ⊕ Q')).toEqual(analisar('P XOR Q'));
    expect(analisar('P → Q')).toEqual(analisar('P -> Q'));
    expect(analisar('P ↔ Q')).toEqual(analisar('P <-> Q'));
  });

  it('ignora espaços e aceita palavras-chave em minúsculas', () => {
    expect(analisar('  not P   and Q ')).toEqual(e(nao(P), Q));
    expect(analisar('(P->Q)AND R')).toEqual(e(implica(P, Q), R));
  });
});

describe('analisar — precedência NOT > AND > OR = XOR > -> > <->', () => {
  it('NOT liga mais forte que AND: fase 1-1', () => {
    expect(analisar('NOT P AND Q')).toEqual(e(nao(P), Q));
  });

  it('AND liga mais forte que OR', () => {
    expect(analisar('P OR Q AND R')).toEqual(ou(P, e(Q, R)));
    expect(analisar('P AND Q OR R')).toEqual(ou(e(P, Q), R));
  });

  it('AND liga mais forte que XOR', () => {
    expect(analisar('P XOR Q AND R')).toEqual(xor(P, e(Q, R)));
  });

  it('OR e XOR têm a mesma precedência e associam à esquerda', () => {
    expect(analisar('P OR Q XOR R')).toEqual(xor(ou(P, Q), R));
    expect(analisar('P XOR Q OR R')).toEqual(ou(xor(P, Q), R));
  });

  it('OR liga mais forte que ->', () => {
    expect(analisar('P OR Q -> R')).toEqual(implica(ou(P, Q), R));
    expect(analisar('P -> Q OR R')).toEqual(implica(P, ou(Q, R)));
  });

  it('-> liga mais forte que <->', () => {
    expect(analisar('P -> Q <-> R')).toEqual(bicondicional(implica(P, Q), R));
    expect(analisar('P <-> Q -> R')).toEqual(bicondicional(P, implica(Q, R)));
  });

  it('-> associa à direita', () => {
    expect(analisar('P -> Q -> R')).toEqual(implica(P, implica(Q, R)));
  });

  it('AND, OR e <-> associam à esquerda', () => {
    expect(analisar('P AND Q AND R')).toEqual(e(e(P, Q), R));
    expect(analisar('P OR Q OR R')).toEqual(ou(ou(P, Q), R));
    expect(analisar('P <-> Q <-> R')).toEqual(bicondicional(bicondicional(P, Q), R));
  });

  it('NOT pode ser repetido (dupla negação) e se aplica só ao átomo seguinte', () => {
    expect(analisar('NOT NOT P')).toEqual(nao(nao(P)));
    expect(analisar('NOT P OR Q')).toEqual(ou(nao(P), Q));
  });

  it('parênteses mudam a ordem', () => {
    expect(analisar('(P -> Q) AND R')).toEqual(e(implica(P, Q), R));
    expect(analisar('NOT (P AND Q)')).toEqual(nao(e(P, Q)));
    expect(analisar('(P OR Q) AND NOT (P AND Q)')).toEqual(e(ou(P, Q), nao(e(P, Q))));
    expect(analisar('((P))')).toEqual(P);
  });

  it('lê as fórmulas dos terminais (fase 5-1)', () => {
    const A = prop('A');
    const B = prop('B');
    expect(analisar('A <-> NOT B')).toEqual(bicondicional(A, nao(B)));
    expect(analisar('B <-> (A <-> B)')).toEqual(bicondicional(B, bicondicional(A, B)));
  });
});

describe('analisar — erros claros para entrada inválida', () => {
  const erroDe = (texto: string): ErroDeSintaxe => {
    try {
      analisar(texto);
    } catch (erro) {
      if (erro instanceof ErroDeSintaxe) return erro;
      throw erro;
    }
    throw new Error(`"${texto}" deveria ser inválida`);
  };

  it('fórmula vazia', () => {
    expect(erroDe('').message).toMatch(/vazia/i);
    expect(erroDe('   ').message).toMatch(/vazia/i);
  });

  it('símbolo desconhecido, com a posição', () => {
    const erro = erroDe('P & Q');
    expect(erro.message).toMatch(/&/);
    expect(erro.posicao).toBe(2);
  });

  it('operando faltando no fim', () => {
    const erro = erroDe('P AND');
    expect(erro.message).toMatch(/terminou/i);
    expect(erro.posicao).toBe(5);
  });

  it('operando faltando no meio', () => {
    const erro = erroDe('P AND OR Q');
    expect(erro.message).toMatch(/OR/);
    expect(erro.posicao).toBe(6);
  });

  it('conectivo faltando entre duas proposições', () => {
    const erro = erroDe('P Q');
    expect(erro.message).toMatch(/conectivo/i);
    expect(erro.posicao).toBe(2);
  });

  it('parêntese aberto sem fechar', () => {
    const erro = erroDe('(P AND Q');
    expect(erro.message).toMatch(/fechar/i);
    expect(erro.posicao).toBe(0);
  });

  it('parêntese fechado sem abrir', () => {
    const erro = erroDe('P AND Q)');
    expect(erro.message).toMatch(/\)/);
    expect(erro.posicao).toBe(7);
  });

  it('NOT sem operando', () => {
    expect(erroDe('NOT').message).toMatch(/terminou/i);
  });

  it('seta incompleta', () => {
    expect(erroDe('P - Q').posicao).toBe(2);
    expect(erroDe('P <- Q').posicao).toBe(2);
  });
});
