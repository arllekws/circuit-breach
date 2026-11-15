import { satisfaz, semLaserLigado, solucoes, type Restricoes } from './satisfatibilidade';
import type { Valoracao } from './tipos';

/** Distância de Hamming: em quantas das proposições `nomes` as duas valorações diferem. */
export function distanciaDeHamming(
  x: Valoracao,
  y: Valoracao,
  nomes: readonly string[] = Object.keys(x),
): number {
  return nomes.filter((nome) => x[nome] !== y[nome]).length;
}

export interface MinimoDeTrocas {
  /** Menor número de trocas de interruptor. */
  readonly trocas: number;
  /** Valoração que resolve a fase com esse número de trocas. */
  readonly alvo: Valoracao;
}

/**
 * Mínimo de trocas como definido no relatório: a menor distância de Hamming entre a
 * valoração inicial e uma valoração que satisfaz todas as condições.
 *
 * `livres` são proposições que não custam troca (placas de pressão): elas podem assumir
 * qualquer valor, e a distância só conta os interruptores.
 * Devolve `null` se a fase não tem solução.
 */
export function minimoTrocas(
  inicial: Valoracao,
  r: Restricoes,
  livres: readonly string[] = [],
): MinimoDeTrocas | null {
  const nomes = Object.keys(inicial).sort();
  const interruptores = nomes.filter((nome) => !livres.includes(nome));
  let melhor: MinimoDeTrocas | null = null;
  for (const alvo of solucoes(r, nomes)) {
    const trocas = distanciaDeHamming(inicial, alvo, interruptores);
    if (melhor === null || trocas < melhor.trocas) melhor = { trocas, alvo };
  }
  return melhor;
}

export interface CaminhoSeguro extends MinimoDeTrocas {
  /** Proposições alteradas, na ordem (inclui as livres, que não contam como troca). */
  readonly ordem: readonly string[];
}

/**
 * Mínimo de trocas respeitando a ORDEM: como o laser dispara no instante em que seu
 * circuito dá 1, nenhuma valoração intermediária pode ligar um laser.
 *
 * É uma busca de menor caminho no grafo cujas vértices são as valorações e cujas arestas
 * trocam uma proposição por vez (custo 1 para interruptor, 0 para proposição livre),
 * passando só por valorações com todos os lasers em 0.
 * Devolve `null` se não existe caminho seguro (ou se a fase já começa com laser ligado).
 */
export function minimoTrocasSeguro(
  inicial: Valoracao,
  r: Restricoes,
  livres: readonly string[] = [],
): CaminhoSeguro | null {
  const nomes = Object.keys(inicial).sort();
  const chave = (v: Valoracao): string => nomes.map((nome) => v[nome]).join('');
  if (!semLaserLigado(r, inicial)) return null;

  interface Visita {
    readonly v: Valoracao;
    readonly custo: number;
    readonly ordem: readonly string[];
  }
  const menorCusto = new Map<string, number>([[chave(inicial), 0]]);
  // Fila ordenada por custo (são no máximo 2ⁿ valorações, n pequeno: ordenar é suficiente).
  const fila: Visita[] = [{ v: inicial, custo: 0, ordem: [] }];

  while (fila.length > 0) {
    fila.sort((x, y) => x.custo - y.custo || x.ordem.length - y.ordem.length);
    const atual = fila.shift() as Visita;
    if (satisfaz(r, atual.v)) {
      return { trocas: atual.custo, alvo: atual.v, ordem: atual.ordem };
    }
    for (const nome of nomes) {
      const vizinha: Valoracao = { ...atual.v, [nome]: atual.v[nome] === 1 ? 0 : 1 };
      if (!semLaserLigado(r, vizinha)) continue; // dispararia o alarme
      const custo = atual.custo + (livres.includes(nome) ? 0 : 1);
      const conhecido = menorCusto.get(chave(vizinha));
      if (conhecido !== undefined && conhecido <= custo) continue;
      menorCusto.set(chave(vizinha), custo);
      fila.push({ v: vizinha, custo, ordem: [...atual.ordem, nome] });
    }
  }
  return null;
}
