import { avaliar } from './avaliar';
import { paraBit, type Bit, type Formula, type Valoracao } from './tipos';

/** Proposições que aparecem na fórmula (ou em várias), sem repetição, em ordem alfabética. */
export function variaveis(...formulas: readonly Formula[]): string[] {
  const nomes = new Set<string>();
  const visitar = (f: Formula): void => {
    if (f.tipo === 'VAR') {
      nomes.add(f.nome);
      return;
    }
    visitar(f.a);
    if (f.tipo !== 'NOT') visitar(f.b);
  };
  formulas.forEach(visitar);
  return [...nomes].sort();
}

/**
 * Todas as 2ⁿ valorações de n proposições, na ordem usual da tabela-verdade:
 * 00…0, 00…1, …, 11…1 (a primeira proposição é a que muda mais devagar).
 */
export function valoracoes(nomes: readonly string[]): Valoracao[] {
  const n = nomes.length;
  const todas: Valoracao[] = [];
  for (let linha = 0; linha < 2 ** n; linha++) {
    const v: Record<string, Bit> = {};
    nomes.forEach((nome, i) => {
      // O bit (n - 1 - i) do número da linha é o valor da i-ésima proposição.
      v[nome] = paraBit(((linha >> (n - 1 - i)) & 1) === 1);
    });
    todas.push(v);
  }
  return todas;
}

export interface LinhaDaTabela {
  readonly valoracao: Valoracao;
  readonly valor: Bit;
}

export interface TabelaVerdade {
  readonly variaveis: readonly string[];
  readonly linhas: readonly LinhaDaTabela[];
}

/**
 * Gerador de tabela-verdade: avalia a fórmula em cada uma das 2ⁿ valorações.
 * `nomes` permite incluir proposições que a fórmula não usa (para comparar fórmulas).
 */
export function tabelaVerdade(f: Formula, nomes: readonly string[] = variaveis(f)): TabelaVerdade {
  return {
    variaveis: nomes,
    linhas: valoracoes(nomes).map((valoracao) => ({
      valoracao,
      valor: paraBit(avaliar(f, valoracao)),
    })),
  };
}
