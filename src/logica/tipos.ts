// Tipos centrais do motor lógico.
// Este módulo (e toda a pasta logica/) é PURO: não conhece DOM, Canvas nem o jogo.

/** Valor de verdade como aparece no jogo: 1 = verdadeiro, 0 = falso. */
export type Bit = 0 | 1;

/**
 * Valoração: função que atribui 1 (V) ou 0 (F) a cada proposição.
 * No jogo, é o conjunto dos estados dos interruptores e placas num instante.
 */
export type Valoracao = Readonly<Record<string, Bit>>;

/** Conectivos binários aceitos. */
export type ConectivoBinario = 'AND' | 'OR' | 'XOR' | 'IMP' | 'IFF';

/**
 * Árvore sintática de uma fórmula da lógica proposicional.
 * União discriminada pelo campo `tipo`: VAR, NOT, AND, OR, XOR, IMP, IFF.
 */
export type Formula =
  | { readonly tipo: 'VAR'; readonly nome: string }
  | { readonly tipo: 'NOT'; readonly a: Formula }
  | { readonly tipo: ConectivoBinario; readonly a: Formula; readonly b: Formula };

export type TipoFormula = Formula['tipo'];

// Construtores curtos, para montar árvores sem passar pelo parser.
export const prop = (nome: string): Formula => ({ tipo: 'VAR', nome });
export const nao = (a: Formula): Formula => ({ tipo: 'NOT', a });
export const e = (a: Formula, b: Formula): Formula => ({ tipo: 'AND', a, b });
export const ou = (a: Formula, b: Formula): Formula => ({ tipo: 'OR', a, b });
export const xor = (a: Formula, b: Formula): Formula => ({ tipo: 'XOR', a, b });
export const implica = (a: Formula, b: Formula): Formula => ({ tipo: 'IMP', a, b });
export const bicondicional = (a: Formula, b: Formula): Formula => ({ tipo: 'IFF', a, b });

/** Converte booleano em 0/1. */
export const paraBit = (valor: boolean): Bit => (valor ? 1 : 0);

/**
 * Usado no `default` dos `switch` sobre `Formula['tipo']`: se um conectivo novo
 * for adicionado e algum switch não o tratar, o compilador acusa o erro aqui.
 */
export function nuncaDeveAcontecer(valor: never): never {
  throw new Error(`Caso não tratado: ${JSON.stringify(valor)}`);
}
