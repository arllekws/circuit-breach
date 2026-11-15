import { describe, expect, it } from 'vitest';
import { analisar } from '../../src/logica/parser';
import { tabelaVerdade, valoracoes, variaveis } from '../../src/logica/tabelaVerdade';

describe('variaveis', () => {
  it('lista as proposições sem repetir, em ordem alfabética', () => {
    expect(variaveis(analisar('(Q -> P) AND Q AND R'))).toEqual(['P', 'Q', 'R']);
    expect(variaveis(analisar('NOT NOT P'))).toEqual(['P']);
  });

  it('junta as proposições de várias fórmulas', () => {
    expect(variaveis(analisar('(P -> Q) AND R'), analisar('Q AND S'))).toEqual(['P', 'Q', 'R', 'S']);
  });
});

describe('valoracoes', () => {
  it('gera 2ⁿ valorações para n = 0..4', () => {
    expect(valoracoes([])).toHaveLength(1);
    expect(valoracoes(['P'])).toHaveLength(2);
    expect(valoracoes(['P', 'Q'])).toHaveLength(4);
    expect(valoracoes(['P', 'Q', 'R'])).toHaveLength(8);
    expect(valoracoes(['P', 'Q', 'R', 'S'])).toHaveLength(16);
  });

  it('segue a ordem usual da tabela-verdade', () => {
    expect(valoracoes(['P', 'Q'])).toEqual([
      { P: 0, Q: 0 },
      { P: 0, Q: 1 },
      { P: 1, Q: 0 },
      { P: 1, Q: 1 },
    ]);
  });

  it('não repete valorações', () => {
    const todas = valoracoes(['P', 'Q', 'R', 'S']).map((v) => JSON.stringify(v));
    expect(new Set(todas).size).toBe(16);
  });
});

describe('tabelaVerdade', () => {
  it('reproduz a tabela do relatório para ¬P ∧ Q (fase 1-1)', () => {
    const tabela = tabelaVerdade(analisar('NOT P AND Q'));
    expect(tabela.variaveis).toEqual(['P', 'Q']);
    expect(tabela.linhas).toEqual([
      { valoracao: { P: 0, Q: 0 }, valor: 0 },
      { valoracao: { P: 0, Q: 1 }, valor: 1 },
      { valoracao: { P: 1, Q: 0 }, valor: 0 },
      { valoracao: { P: 1, Q: 1 }, valor: 0 },
    ]);
  });

  it('tem 2ⁿ linhas', () => {
    expect(tabelaVerdade(analisar('P')).linhas).toHaveLength(2);
    expect(tabelaVerdade(analisar('(P -> Q) AND R')).linhas).toHaveLength(8);
    expect(tabelaVerdade(analisar('P AND Q AND R AND S')).linhas).toHaveLength(16);
  });

  it('aceita proposições extras que a fórmula não usa', () => {
    const tabela = tabelaVerdade(analisar('P'), ['P', 'Q']);
    expect(tabela.linhas.map((l) => l.valor)).toEqual([0, 0, 1, 1]);
  });
});
