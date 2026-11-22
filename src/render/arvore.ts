import { avaliar } from '../logica/avaliar';
import { analisar } from '../logica/parser';
import { paraBit, type Bit, type ConectivoBinario, type Formula, type Valoracao } from '../logica/tipos';

// Árvore "de exibição": a mesma árvore sintática da fórmula, já avaliada, no formato que o
// painel do circuito desenha (entradas à esquerda, portas lógicas, saída à direita).
// Módulo puro (sem Canvas): é testado em testes/render/arvore.test.ts.

export type Operador = 'not' | 'and' | 'or' | 'xor' | 'imp' | 'bic' | 'unk';
/** Valor do nó: 0, 1, ou '?' quando depende de um espaço ainda vazio (Firewall). */
export type ValorExibido = Bit | '?';

export type NoExibido =
  | { readonly in: string; readonly v: ValorExibido }
  | {
      readonly op: Operador;
      readonly v: ValorExibido;
      readonly a: readonly NoExibido[];
      /** Destacado em âmbar (espaço sob o cursor no Firewall). */
      readonly sel?: boolean;
    };

const OPERADOR: Readonly<Record<ConectivoBinario, Operador>> = {
  AND: 'and',
  OR: 'or',
  XOR: 'xor',
  IMP: 'imp',
  IFF: 'bic',
};

/** Árvore da fórmula avaliada na valoração: cada porta lógica traz o próprio resultado. */
export function arvoreAvaliada(f: Formula, v: Valoracao): NoExibido {
  const valor = paraBit(avaliar(f, v));
  switch (f.tipo) {
    case 'VAR':
      return { in: f.nome, v: valor };
    case 'NOT':
      return { op: 'not', v: valor, a: [arvoreAvaliada(f.a, v)] };
    default:
      return { op: OPERADOR[f.tipo], v: valor, a: [arvoreAvaliada(f.a, v), arvoreAvaliada(f.b, v)] };
  }
}

/** Altura da árvore: 0 para entrada; cada porta soma 1. */
export function altura(no: NoExibido): number {
  return 'in' in no ? 0 : 1 + Math.max(...no.a.map(altura));
}

export function folhas(no: NoExibido): number {
  return 'in' in no ? 1 : no.a.reduce((soma, filho) => soma + folhas(filho), 0);
}

/**
 * Árvore do circuito do Firewall de montagem, com os espaços ainda vazios.
 * Os espaços (?1, ?2, …) viram portas '?' e tudo que depende deles fica com valor '?'.
 * O espaço `cursor` (índice a partir de 0) sai destacado.
 */
export function arvoreDoMolde(
  molde: string,
  escolhas: readonly (ConectivoBinario | null)[],
  v: Valoracao,
  cursor: number,
): NoExibido {
  // 1. Lê os conectivos binários do molde na ordem em que aparecem no texto.
  //    Cada espaço vazio é trocado por AND só para o parser conseguir montar a árvore.
  const ordem: (number | null)[] = []; // número do espaço (0, 1, …) ou null para conectivo fixo
  const texto = molde.replace(/\?(\d+)|<->|->|\bAND\b|\bOR\b|\bXOR\b/g, (trecho, numero?: string) => {
    if (numero === undefined) {
      ordem.push(null);
      return trecho;
    }
    const espaco = Number(numero) - 1;
    ordem.push(espaco);
    const escolha = escolhas[espaco] ?? null;
    return escolha === null ? 'AND' : { AND: 'AND', OR: 'OR', XOR: 'XOR', IMP: '->', IFF: '<->' }[escolha];
  });
  const formula = analisar(texto);

  // 2. Percorre a árvore em ordem (esquerda, nó, direita): os conectivos binários aparecem
  //    exatamente na ordem do texto, então o k-ésimo é o k-ésimo item de `ordem`.
  let k = 0;
  const visitar = (f: Formula): NoExibido => {
    if (f.tipo === 'VAR') return { in: f.nome, v: v[f.nome] ?? 0 };
    if (f.tipo === 'NOT') {
      const filho = visitar(f.a);
      return { op: 'not', v: filho.v === '?' ? '?' : filho.v === 1 ? 0 : 1, a: [filho] };
    }
    const esquerda = visitar(f.a);
    const espaco = ordem[k++] ?? null;
    const direita = visitar(f.b);
    const vazio = espaco !== null && (escolhas[espaco] ?? null) === null;
    const op: Operador = vazio ? 'unk' : OPERADOR[f.tipo];
    const indefinido = vazio || esquerda.v === '?' || direita.v === '?';
    return {
      op,
      v: indefinido ? '?' : paraBit(avaliar(f, v)),
      a: [esquerda, direita],
      sel: espaco !== null && espaco === cursor,
    };
  };
  return visitar(formula);
}
