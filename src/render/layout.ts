import type { Acao, Fase, Posicao } from '../jogo/tipos';
import { CELULA } from './tema';

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Retângulo da tela que responde ao clique do mouse, e a ação que ele dispara. */
export interface RegiaoClicavel {
  readonly r: Retangulo;
  readonly acao: Acao;
}

// Tela de referência 680×400; o canvas inteiro é escalado proporcionalmente.
export const TELA = { w: 680, h: 400 } as const;
export const BARRA: Retangulo = { x: 0, y: 0, w: 680, h: 34 };
/** Mapa à esquerda (~60% da largura): cabem 13×11 células de 30 px. */
export const AREA_MAPA: Retangulo = { x: 8, y: 40, w: 394, h: 334 };
/** Painel do circuito à direita. */
export const PAINEL: Retangulo = { x: 410, y: 40, w: 262, h: 334 };
export const RODAPE: Retangulo = { x: 0, y: 378, w: 680, h: 22 };

/** Canto superior esquerdo do mapa da fase, centralizado na área do mapa. */
export function origemDoMapa(fase: Fase): Posicao {
  return {
    x: Math.round(AREA_MAPA.x + (AREA_MAPA.w - fase.largura * CELULA) / 2),
    y: Math.round(AREA_MAPA.y + (AREA_MAPA.h - fase.altura * CELULA) / 2),
  };
}

/**
 * Ajusta o canvas à janela mantendo a proporção 680×400 e a nitidez em telas de alta
 * densidade. Depois disso, todo o desenho usa as coordenadas da tela de referência.
 */
export function ajustarCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const escala = Math.min(window.innerWidth / TELA.w, window.innerHeight / TELA.h);
  const densidade = window.devicePixelRatio || 1;
  canvas.style.width = `${Math.floor(TELA.w * escala)}px`;
  canvas.style.height = `${Math.floor(TELA.h * escala)}px`;
  canvas.width = Math.floor(TELA.w * escala * densidade);
  canvas.height = Math.floor(TELA.h * escala * densidade);
  ctx.setTransform(escala * densidade, 0, 0, escala * densidade, 0, 0);
}
