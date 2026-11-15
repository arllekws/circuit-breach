import { describe, expect, it } from 'vitest';
import { classificar, contingencia, contradicao, tautologia } from '../../src/logica/classificar';
import { equivalentes } from '../../src/logica/equivalentes';
import { analisar } from '../../src/logica/parser';

const eq = (x: string, y: string): boolean => equivalentes(analisar(x), analisar(y));

describe('classificar — tautologia, contradição, contingência', () => {
  it('P ∨ ¬P é tautologia (painel sempre ativo)', () => {
    expect(classificar(analisar('P OR NOT P'))).toBe('tautologia');
    expect(tautologia(analisar('P OR NOT P'))).toBe(true);
  });

  it('Q ∧ ¬Q é contradição (painel corrompido)', () => {
    expect(classificar(analisar('Q AND NOT Q'))).toBe('contradicao');
    expect(contradicao(analisar('Q AND NOT Q'))).toBe(true);
  });

  it('¬P ∧ Q é contingência (painel comum)', () => {
    expect(classificar(analisar('NOT P AND Q'))).toBe('contingencia');
    expect(contingencia(analisar('NOT P AND Q'))).toBe(true);
  });

  it('outras tautologias e contradições conhecidas', () => {
    expect(tautologia(analisar('P -> P'))).toBe(true);
    expect(tautologia(analisar('(P -> Q) AND P -> Q'))).toBe(true); // Modus Ponens como fórmula
    expect(tautologia(analisar('P <-> NOT NOT P'))).toBe(true);
    expect(contradicao(analisar('P <-> NOT P'))).toBe(true);
    expect(contradicao(analisar('P XOR P'))).toBe(true);
    expect(tautologia(analisar('P -> Q'))).toBe(false);
  });
});

describe('equivalentes — mesma tabela-verdade', () => {
  it('Leis de De Morgan', () => {
    expect(eq('NOT (P AND Q)', 'NOT P OR NOT Q')).toBe(true);
    expect(eq('NOT (P OR Q)', 'NOT P AND NOT Q')).toBe(true);
  });

  it('o cabo errado do firewall espelhado NÃO é equivalente', () => {
    expect(eq('NOT (P AND Q)', 'NOT P AND NOT Q')).toBe(false);
    expect(eq('NOT (P OR Q)', 'NOT P OR NOT Q')).toBe(false);
  });

  it('dupla negação: ¬¬P ≡ P', () => {
    expect(eq('NOT NOT P', 'P')).toBe(true);
    expect(eq('NOT NOT P', 'NOT P')).toBe(false);
  });

  it('P → Q ≡ ¬P ∨ Q', () => {
    expect(eq('P -> Q', 'NOT P OR Q')).toBe(true);
    expect(eq('P -> Q', 'P OR NOT Q')).toBe(false);
    expect(eq('P -> Q', 'Q -> P')).toBe(false); // a recíproca não é equivalente
    expect(eq('P -> Q', 'NOT Q -> NOT P')).toBe(true); // a contrapositiva é
  });

  it('XOR montado com AND, OR e NOT (Firewall de montagem)', () => {
    expect(eq('P XOR Q', '(P OR Q) AND NOT (P AND Q)')).toBe(true);
    expect(eq('P XOR Q', 'NOT (P <-> Q)')).toBe(true);
    expect(eq('P XOR Q', 'P OR Q')).toBe(false);
  });

  it('compara fórmulas com conjuntos diferentes de proposições', () => {
    expect(eq('P', 'P AND (Q OR NOT Q)')).toBe(true);
    expect(eq('P', 'P AND Q')).toBe(false);
  });

  it('a ordem dos operandos não importa para AND e OR', () => {
    expect(eq('P AND Q', 'Q AND P')).toBe(true);
    expect(eq('P -> Q', 'Q -> P')).toBe(false);
  });

  it('duas fórmulas são equivalentes exatamente quando o bicondicional entre elas é tautologia', () => {
    expect(tautologia(analisar('NOT (P AND Q) <-> (NOT P OR NOT Q)'))).toBe(true);
    expect(tautologia(analisar('NOT (P AND Q) <-> (NOT P AND NOT Q)'))).toBe(false);
  });
});
