import { describe, expect, it } from 'vitest';
import { avaliarPassoAPasso, subformulas } from '../../src/logica/avaliar';
import { formatar } from '../../src/logica/formatar';
import { analisar } from '../../src/logica/parser';

const textos = (lista: { formula: Parameters<typeof formatar>[0]; valor: number }[]) =>
  lista.map((p) => `${formatar(p.formula)} = ${p.valor}`);

describe('subformulas', () => {
  it('lista as portas do circuito de dentro para fora; a última é a saída', () => {
    expect(subformulas(analisar('NOT P AND Q')).map((f) => formatar(f))).toEqual(['¬P', '¬P ∧ Q']);
    expect(subformulas(analisar('(P -> Q) AND R')).map((f) => formatar(f))).toEqual([
      'P → Q',
      '(P → Q) ∧ R',
    ]);
  });

  it('não repete subfórmulas iguais', () => {
    expect(subformulas(analisar('(P AND Q) OR NOT (P AND Q)')).map((f) => formatar(f))).toEqual([
      'P ∧ Q',
      '¬(P ∧ Q)',
      'P ∧ Q ∨ ¬(P ∧ Q)',
    ]);
  });

  it('uma proposição sozinha não tem portas', () => {
    expect(subformulas(analisar('P'))).toEqual([]);
  });
});

describe('avaliarPassoAPasso', () => {
  it('reproduz o exemplo do relatório para a fase 1-1', () => {
    const porta = analisar('NOT P AND Q');
    expect(textos(avaliarPassoAPasso(porta, { P: 1, Q: 0 }))).toEqual(['¬P = 0', '¬P ∧ Q = 0']);
    expect(textos(avaliarPassoAPasso(porta, { P: 0, Q: 0 }))).toEqual(['¬P = 1', '¬P ∧ Q = 0']);
    expect(textos(avaliarPassoAPasso(porta, { P: 0, Q: 1 }))).toEqual(['¬P = 1', '¬P ∧ Q = 1']);
  });

  it('fase 3-2: a implicação com antecedente falso é verdadeira', () => {
    expect(textos(avaliarPassoAPasso(analisar('(P -> Q) AND R'), { P: 0, Q: 0, R: 1 }))).toEqual([
      'P → Q = 1',
      '(P → Q) ∧ R = 1',
    ]);
  });
});
