import { describe, expect, it } from 'vitest';
import { formatar, iguais, nomeDoConectivo } from '../../src/logica/formatar';
import { analisar } from '../../src/logica/parser';
import { e, nao, ou, prop } from '../../src/logica/tipos';

describe('formatar', () => {
  it('usa os símbolos da lógica', () => {
    expect(formatar(analisar('NOT P AND Q'))).toBe('¬P ∧ Q');
    expect(formatar(analisar('(P -> Q) AND R'))).toBe('(P → Q) ∧ R');
    expect(formatar(analisar('A <-> NOT B'))).toBe('A ↔ ¬B');
    expect(formatar(analisar('P XOR Q'))).toBe('P ⊕ Q');
    expect(formatar(analisar('NOT (P AND Q)'))).toBe('¬(P ∧ Q)');
    expect(formatar(analisar('NOT NOT P'))).toBe('¬¬P');
  });

  it('também escreve no formato de texto das fases', () => {
    expect(formatar(analisar('(P → Q) ∧ R'), 'texto')).toBe('(P -> Q) AND R');
    expect(formatar(analisar('¬P ∨ ¬Q'), 'texto')).toBe('NOT P OR NOT Q');
  });

  it('só põe parênteses quando necessário', () => {
    expect(formatar(analisar('P AND Q AND R'))).toBe('P ∧ Q ∧ R');
    expect(formatar(analisar('P AND (Q AND R)'))).toBe('P ∧ (Q ∧ R)');
    expect(formatar(analisar('P -> Q -> R'))).toBe('P → Q → R');
    expect(formatar(analisar('(P -> Q) -> R'))).toBe('(P → Q) → R');
    expect(formatar(analisar('B <-> (A <-> B)'))).toBe('B ↔ (A ↔ B)');
  });

  it('ida e volta: analisar(formatar(f)) devolve a mesma árvore', () => {
    const casos = [
      'NOT P AND Q',
      '(P -> Q) AND R',
      'P -> Q -> R',
      '(P -> Q) -> R',
      'P OR Q XOR R',
      'P OR (Q XOR R)',
      '(P OR Q) AND NOT (P AND Q)',
      'B <-> (A <-> B)',
      'NOT NOT P',
      'NOT (P -> Q) <-> P AND NOT Q',
      'P AND (Q OR R) -> S',
    ];
    for (const texto of casos) {
      const f = analisar(texto);
      expect(iguais(analisar(formatar(f)), f), texto).toBe(true);
      expect(iguais(analisar(formatar(f, 'texto')), f), texto).toBe(true);
    }
  });
});

describe('iguais — igualdade estrutural de árvores', () => {
  it('compara forma, não significado', () => {
    const P = prop('P');
    const Q = prop('Q');
    expect(iguais(e(P, Q), e(P, Q))).toBe(true);
    expect(iguais(e(P, Q), e(Q, P))).toBe(false); // equivalentes, mas árvores diferentes
    expect(iguais(nao(P), nao(P))).toBe(true);
    expect(iguais(nao(P), P)).toBe(false);
    expect(iguais(e(P, Q), ou(P, Q))).toBe(false);
    expect(iguais(P, prop('P'))).toBe(true);
    expect(iguais(P, Q)).toBe(false);
  });
});

describe('nomeDoConectivo', () => {
  it('dá o nome da porta lógica mostrado no painel', () => {
    expect(nomeDoConectivo('IMP')).toBe('IMPLICA');
    expect(nomeDoConectivo('IFF')).toBe('BICOND');
    expect(nomeDoConectivo('AND')).toBe('AND');
  });
});
