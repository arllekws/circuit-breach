import { tabelaVerdade } from './tabelaVerdade';
import type { Formula } from './tipos';

export type Classificacao = 'tautologia' | 'contradicao' | 'contingencia';

/**
 * Classifica a fórmula olhando a coluna final da sua tabela-verdade:
 *  - tautologia:   1 em todas as valorações (painel "sempre ativo");
 *  - contradição:  0 em todas as valorações (painel "corrompido");
 *  - contingência: depende da valoração (painel comum).
 */
export function classificar(f: Formula): Classificacao {
  const valores = tabelaVerdade(f).linhas.map((linha) => linha.valor);
  if (valores.every((valor) => valor === 1)) return 'tautologia';
  if (valores.every((valor) => valor === 0)) return 'contradicao';
  return 'contingencia';
}

export const tautologia = (f: Formula): boolean => classificar(f) === 'tautologia';
export const contradicao = (f: Formula): boolean => classificar(f) === 'contradicao';
export const contingencia = (f: Formula): boolean => classificar(f) === 'contingencia';
