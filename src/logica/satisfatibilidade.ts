import { avaliar } from './avaliar';
import { valoracoes, variaveis } from './tabelaVerdade';
import type { Formula, Valoracao } from './tipos';

/**
 * Condições simultâneas de uma fase: circuitos que precisam dar 1 (portas e pontes)
 * e circuitos que precisam dar 0 (lasers).
 */
export interface Restricoes {
  readonly devemSer1: readonly Formula[];
  readonly devemSer0: readonly Formula[];
}

/** A valoração satisfaz todas as condições ao mesmo tempo? */
export function satisfaz(r: Restricoes, v: Valoracao): boolean {
  return r.devemSer1.every((f) => avaliar(f, v)) && r.devemSer0.every((f) => !avaliar(f, v));
}

/** Nenhum circuito que deve ficar em 0 (laser) está em 1 nesta valoração? */
export function semLaserLigado(r: Restricoes, v: Valoracao): boolean {
  return r.devemSer0.every((f) => !avaliar(f, v));
}

/**
 * Todas as valorações que satisfazem as condições, percorrendo a tabela-verdade inteira.
 * `nomes` permite fixar o conjunto de proposições (por padrão, as que aparecem nas fórmulas).
 */
export function solucoes(
  r: Restricoes,
  nomes: readonly string[] = variaveis(...r.devemSer1, ...r.devemSer0),
): Valoracao[] {
  return valoracoes(nomes).filter((v) => satisfaz(r, v));
}

/** Satisfatibilidade: existe ao menos uma valoração que satisfaz todas as condições? */
export function satisfativel(r: Restricoes): boolean {
  return solucoes(r).length > 0;
}
