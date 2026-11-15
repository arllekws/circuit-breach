import { tabelaVerdade, variaveis } from './tabelaVerdade';
import type { Formula } from './tipos';

/**
 * Equivalência lógica: duas fórmulas são equivalentes quando têm a mesma tabela-verdade,
 * isto é, o mesmo valor em TODAS as valorações das proposições que aparecem em qualquer uma.
 * O jogo compara tabelas, não desenhos: é assim que o Firewall aceita qualquer circuito correto.
 */
export function equivalentes(x: Formula, y: Formula): boolean {
  const nomes = variaveis(x, y);
  const colunaX = tabelaVerdade(x, nomes).linhas;
  const colunaY = tabelaVerdade(y, nomes).linhas;
  return colunaX.every((linha, i) => linha.valor === colunaY[i]?.valor);
}
