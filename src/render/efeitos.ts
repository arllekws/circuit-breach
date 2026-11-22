// Estado do modo invasão (animações ambientes). Desligado por padrão: com `ligado` falso as
// telas ficam estáticas e respeitam a regra de animações ≤ 200 ms. Os desenhos do modo
// ficam em modoInvasao.ts; aqui só o estado e os ganchos que o renderer chama.

/** 0 = desligado (telão), 1 = sutil, 2 = invasão. */
export type NivelDeEfeitos = 0 | 1 | 2;

type Gancho = (...args: never[]) => void;

export const FX = {
  nivel: 0 as NivelDeEfeitos,
  /** Tempo em segundos (relógio do laço principal). */
  t: 0,
  /** Momento em que a tela atual apareceu (títulos "descriptografam" a partir dele). */
  t0: 0,
  /** Nome da tela atual: 'menu', 'fase', 'vitoria', 'final', … */
  tela: '',
  ganchos: {} as Record<string, Gancho>,
  get ligado(): boolean {
    return this.nivel > 0;
  },
};

/** Chama um gancho do modo invasão, se ele estiver ligado e registrado. */
export function fx<A extends unknown[]>(nome: string, ...args: A): void {
  const gancho = FX.ganchos[nome] as ((...a: A) => void) | undefined;
  if (FX.ligado && gancho !== undefined) gancho(...args);
}

export const hash = (a: number, b = 0): number => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
