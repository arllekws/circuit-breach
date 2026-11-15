import { describe, expect, it } from 'vitest';
import fase11 from '../../src/fases/dados/1-1.json';
import fase32 from '../../src/fases/dados/3-2.json';
import {
  carregarProgresso,
  faseLiberada,
  registrarVitoria,
  salvarProgresso,
  totalDeEstrelas,
  type Armazenamento,
} from '../../src/jogo/progresso';
import { tabelaDoScanner } from '../../src/jogo/scanner';
import { faseDe } from '../apoio';

describe('tabelaDoScanner', () => {
  it('fase 1-1: a tabela do relatório, com a linha atual e a linha-alvo', () => {
    const porta = faseDe(fase11).portas[0]!;
    const tabela = tabelaDoScanner(porta, { P: 1, Q: 0 });
    expect(tabela.colunas).toEqual(['P', 'Q', '¬P', '¬P ∧ Q']);
    expect(tabela.proposicoes).toBe(2);
    expect(tabela.linhas.map((l) => l.valores)).toEqual([
      [0, 0, 1, 0],
      [0, 1, 1, 1],
      [1, 0, 0, 0],
      [1, 1, 0, 0],
    ]);
    expect(tabela.linhas.map((l) => l.atual)).toEqual([false, false, true, false]);
    expect(tabela.linhas.map((l) => l.alvo)).toEqual([false, true, false, false]);
  });

  it('a linha atual acompanha a valoração', () => {
    const porta = faseDe(fase11).portas[0]!;
    const tabela = tabelaDoScanner(porta, { P: 0, Q: 1 });
    expect(tabela.linhas.map((l) => l.atual)).toEqual([false, true, false, false]);
  });

  it('para laser, as linhas-alvo são as que dão 0', () => {
    const laser = faseDe(fase32).lasers[0]!; // Q ∧ R
    const tabela = tabelaDoScanner(laser, { P: 1, Q: 1, R: 0 });
    expect(tabela.colunas).toEqual(['Q', 'R', 'Q ∧ R']);
    expect(tabela.linhas.map((l) => l.alvo)).toEqual([true, true, true, false]);
    // P não aparece no circuito: a linha atual só olha Q e R.
    expect(tabela.linhas.map((l) => l.atual)).toEqual([false, false, true, false]);
  });

  it('tem 2ⁿ linhas', () => {
    const porta = faseDe(fase32).portas[0]!; // (P → Q) ∧ R
    expect(tabelaDoScanner(porta, { P: 1, Q: 1, R: 0 }).linhas).toHaveLength(8);
  });
});

function armazenamentoFalso(inicial: Record<string, string> = {}): Armazenamento & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (chave) => dados[chave] ?? null,
    setItem: (chave, valor) => {
      dados[chave] = valor;
    },
  };
}

describe('progresso', () => {
  it('começa vazio', () => {
    expect(carregarProgresso(armazenamentoFalso())).toEqual({});
  });

  it('salva e carrega de volta', () => {
    const armazenamento = armazenamentoFalso();
    salvarProgresso(armazenamento, registrarVitoria({}, '1-1', 3));
    expect(carregarProgresso(armazenamento)).toEqual({ '1-1': 3 });
  });

  it('guarda sempre o melhor resultado', () => {
    let progresso = registrarVitoria({}, '1-1', 2);
    progresso = registrarVitoria(progresso, '1-1', 1);
    expect(progresso['1-1']).toBe(2);
    progresso = registrarVitoria(progresso, '1-1', 3);
    expect(progresso['1-1']).toBe(3);
  });

  it('ignora dados corrompidos', () => {
    const chave = 'circuit-breach:progresso:v1';
    expect(carregarProgresso(armazenamentoFalso({ [chave]: 'não é json' }))).toEqual({});
    expect(carregarProgresso(armazenamentoFalso({ [chave]: '[1,2]' }))).toEqual({});
    expect(carregarProgresso(armazenamentoFalso({ [chave]: '{"1-1":3,"1-2":99,"x":"y"}' }))).toEqual({
      '1-1': 3,
    });
  });

  it('não quebra se o navegador recusar a gravação', () => {
    const quebrado: Armazenamento = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cota cheia');
      },
    };
    expect(carregarProgresso(quebrado)).toEqual({});
    expect(() => salvarProgresso(quebrado, { '1-1': 3 })).not.toThrow();
  });

  it('libera cada fase quando a anterior é vencida', () => {
    const ids = ['1-1', '1-2', '2-1'];
    expect(faseLiberada(ids, {}, 0)).toBe(true);
    expect(faseLiberada(ids, {}, 1)).toBe(false);
    expect(faseLiberada(ids, { '1-1': 1 }, 1)).toBe(true);
    expect(faseLiberada(ids, { '1-1': 1 }, 2)).toBe(false);
  });

  it('soma as estrelas', () => {
    expect(totalDeEstrelas({ '1-1': 3, '1-2': 2 })).toBe(5);
  });
});
