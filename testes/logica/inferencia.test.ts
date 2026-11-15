import { describe, expect, it } from 'vitest';
import { tautologia } from '../../src/logica/classificar';
import { formatar } from '../../src/logica/formatar';
import {
  aplicarRegra,
  REGRAS,
  type ComplementoDaRegra,
  type Regra,
} from '../../src/logica/inferencia';
import { analisar } from '../../src/logica/parser';
import { e, implica, type Formula } from '../../src/logica/tipos';

/** Aplica a regra a premissas em texto e devolve a conclusão formatada (ou null se recusada). */
function concluir(regra: Regra, premissas: string[], complemento?: ComplementoDaRegra): string | null {
  const resultado = aplicarRegra(regra, premissas.map(analisar), complemento);
  return resultado.ok ? formatar(resultado.conclusao) : null;
}

describe('aplicarRegra — cada regra aceita o que casa com o esquema', () => {
  it('Modus Ponens: P → Q, P ⊢ Q', () => {
    expect(concluir('MP', ['P -> Q', 'P'])).toBe('Q');
    expect(concluir('MP', ['P', 'P -> Q'])).toBe('Q'); // ordem das linhas não importa
    expect(concluir('MP', ['(P AND Q) -> NOT R', 'P AND Q'])).toBe('¬R');
  });

  it('Modus Tollens: P → Q, ¬Q ⊢ ¬P', () => {
    expect(concluir('MT', ['P -> Q', 'NOT Q'])).toBe('¬P');
    expect(concluir('MT', ['NOT Q', 'P -> Q'])).toBe('¬P');
  });

  it('Silogismo Hipotético: P → Q, Q → R ⊢ P → R', () => {
    expect(concluir('SH', ['P -> Q', 'Q -> R'])).toBe('P → R');
    expect(concluir('SH', ['Q -> R', 'P -> Q'])).toBe('P → R');
  });

  it('Silogismo Disjuntivo: P ∨ Q, ¬P ⊢ Q', () => {
    expect(concluir('SD', ['P OR Q', 'NOT P'])).toBe('Q');
    expect(concluir('SD', ['P OR Q', 'NOT Q'])).toBe('P');
  });

  it('Simplificação: P ∧ Q ⊢ P (ou Q)', () => {
    expect(concluir('SIMP', ['P AND Q'])).toBe('P');
    expect(concluir('SIMP', ['P AND Q'], { lado: 'direita' })).toBe('Q');
  });

  it('Conjunção: P, Q ⊢ P ∧ Q', () => {
    expect(concluir('CONJ', ['P', 'Q'])).toBe('P ∧ Q');
    expect(concluir('CONJ', ['P -> Q', 'NOT R'])).toBe('(P → Q) ∧ ¬R');
  });

  it('Adição: P ⊢ P ∨ Q', () => {
    expect(concluir('AD', ['P'], { formula: analisar('Q') })).toBe('P ∨ Q');
  });
});

describe('aplicarRegra — recusa passos inválidos, com motivo', () => {
  it('Modus Ponens: falácia da afirmação do consequente (P → Q, Q ⊬ P)', () => {
    expect(concluir('MP', ['P -> Q', 'Q'])).toBeNull();
  });

  it('Modus Ponens: o antecedente precisa ser o MESMO A', () => {
    expect(concluir('MP', ['P -> Q', 'R'])).toBeNull();
    expect(concluir('MP', ['P', 'Q'])).toBeNull();
  });

  it('Modus Tollens: falácia da negação do antecedente (P → Q, ¬P ⊬ ¬Q)', () => {
    expect(concluir('MT', ['P -> Q', 'NOT P'])).toBeNull();
    expect(concluir('MT', ['P -> Q', 'Q'])).toBeNull();
  });

  it('Silogismo Hipotético: o termo do meio precisa coincidir', () => {
    expect(concluir('SH', ['P -> Q', 'R -> S'])).toBeNull();
    expect(concluir('SH', ['P -> Q', 'NOT R'])).toBeNull();
  });

  it('Silogismo Disjuntivo: precisa negar um dos lados da disjunção', () => {
    expect(concluir('SD', ['P OR Q', 'NOT R'])).toBeNull();
    expect(concluir('SD', ['P OR Q', 'P'])).toBeNull();
    expect(concluir('SD', ['P AND Q', 'NOT P'])).toBeNull();
  });

  it('Simplificação: só vale para conjunção', () => {
    expect(concluir('SIMP', ['P OR Q'])).toBeNull();
  });

  it('Adição: precisa da fórmula a acrescentar', () => {
    expect(concluir('AD', ['P'])).toBeNull();
  });

  it('número errado de linhas', () => {
    expect(concluir('MP', ['P -> Q'])).toBeNull();
    expect(concluir('SIMP', ['P AND Q', 'R'])).toBeNull();
    expect(concluir('CONJ', ['P'])).toBeNull();
  });

  it('a recusa explica o motivo', () => {
    const resultado = aplicarRegra('MP', [analisar('P -> Q'), analisar('Q')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toMatch(/Modus Ponens/);
      expect(resultado.motivo).toMatch(/A → B, A ⊢ B/);
    }
  });
});

describe('correção das regras: (premissas) → conclusão é sempre tautologia', () => {
  const casos: [Regra, string[], ComplementoDaRegra?][] = [
    ['MP', ['P -> Q', 'P']],
    ['MT', ['P -> Q', 'NOT Q']],
    ['SH', ['P -> Q', 'Q -> R']],
    ['SD', ['P OR Q', 'NOT P']],
    ['SD', ['P OR Q', 'NOT Q']],
    ['SIMP', ['P AND Q']],
    ['SIMP', ['P AND Q'], { lado: 'direita' }],
    ['CONJ', ['P', 'Q']],
    ['AD', ['P'], { formula: analisar('Q') }],
  ];

  it.each(casos)('%s com %j', (regra, textos, complemento) => {
    const premissas = textos.map(analisar);
    const resultado = aplicarRegra(regra, premissas, complemento);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const conjuncaoDasPremissas = premissas.reduce((acumulado: Formula, p) => e(acumulado, p));
    expect(tautologia(implica(conjuncaoDasPremissas, resultado.conclusao))).toBe(true);
  });

  it('todas as 7 regras do relatório estão descritas', () => {
    expect(Object.keys(REGRAS).sort()).toEqual(['AD', 'CONJ', 'MP', 'MT', 'SD', 'SH', 'SIMP']);
  });
});

describe('fase 5-2 (Núcleo Central): prova de ¬P a partir de P → Q, Q → R, ¬R', () => {
  it('SH(1,2) dá P → R; MT(4,3) dá ¬P', () => {
    const linhas: Formula[] = ['P -> Q', 'Q -> R', 'NOT R'].map(analisar);

    const passo4 = aplicarRegra('SH', [linhas[0]!, linhas[1]!]);
    expect(passo4.ok && formatar(passo4.conclusao)).toBe('P → R');
    if (!passo4.ok) return;
    linhas.push(passo4.conclusao);

    const passo5 = aplicarRegra('MT', [linhas[3]!, linhas[2]!]);
    expect(passo5.ok && formatar(passo5.conclusao)).toBe('¬P');
  });

  it('caminho alternativo: MT(2,3) dá ¬Q; MT(1,4) dá ¬P', () => {
    expect(concluir('MT', ['Q -> R', 'NOT R'])).toBe('¬Q');
    expect(concluir('MT', ['P -> Q', 'NOT Q'])).toBe('¬P');
  });

  it('um passo inválido é recusado: MP(1,3) não se aplica', () => {
    expect(concluir('MP', ['P -> Q', 'NOT R'])).toBeNull();
  });
});
