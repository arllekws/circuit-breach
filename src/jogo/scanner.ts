import { avaliar, subformulas } from '../logica/avaliar';
import { formatar } from '../logica/formatar';
import { valoracoes, variaveis } from '../logica/tabelaVerdade';
import { paraBit, type Bit, type Valoracao } from '../logica/tipos';
import type { Circuito } from './tipos';

export interface LinhaDoScanner {
  /** Valores das proposições e, depois, de cada subfórmula (a última é a saída). */
  readonly valores: readonly Bit[];
  /** É a linha da valoração atual do jogo? */
  readonly atual: boolean;
  /** A saída desta linha é a que o elemento precisa (1 para porta/ponte, 0 para laser)? */
  readonly alvo: boolean;
}

export interface TabelaDoScanner {
  /** Cabeçalhos: proposições e depois subfórmulas, de dentro para fora. */
  readonly colunas: readonly string[];
  /** Quantas das colunas são proposições. */
  readonly proposicoes: number;
  readonly linhas: readonly LinhaDoScanner[];
}

/**
 * Tabela-verdade que o Scanner mostra: uma linha por valoração das proposições do circuito,
 * com uma coluna para cada subfórmula (como se faz à mão), a linha atual e as linhas-alvo.
 */
export function tabelaDoScanner(circuito: Circuito, valoracaoAtual: Valoracao): TabelaDoScanner {
  const nomes = variaveis(circuito.formula);
  const partes = subformulas(circuito.formula);
  const saidaDesejada = circuito.tipo === 'laser' ? 0 : 1;

  const linhas = valoracoes(nomes).map((v): LinhaDoScanner => {
    const valores = [
      ...nomes.map((nome) => v[nome] as Bit),
      ...partes.map((parte) => paraBit(avaliar(parte, v))),
    ];
    return {
      valores,
      atual: nomes.every((nome) => v[nome] === valoracaoAtual[nome]),
      alvo: paraBit(avaliar(circuito.formula, v)) === saidaDesejada,
    };
  });
  return {
    colunas: [...nomes, ...partes.map((parte) => formatar(parte))],
    proposicoes: nomes.length,
    linhas,
  };
}
