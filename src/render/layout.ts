import type { Tutorial } from '../jogo/tutorial';
import type { Acao, Fase, Posicao } from '../jogo/tipos';
import type { Valoracao } from '../logica/tipos';
import type { Variante } from './primitivas';
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
/** Mapa à esquerda. */
export const AREA_MAPA: Retangulo = { x: 8, y: 34, w: 390, h: 338 };
/** Painel do circuito à direita. */
export const PAINEL: Retangulo = { x: 406, y: 34, w: 266, h: 338 };

/** Canto superior esquerdo do mapa da fase, centralizado na área do mapa. */
export function origemDoMapa(fase: Fase): Posicao {
  return {
    x: Math.round(AREA_MAPA.x + (AREA_MAPA.w - fase.largura * CELULA) / 2),
    y: Math.round(AREA_MAPA.y + (AREA_MAPA.h - fase.altura * CELULA) / 2),
  };
}

export interface Aviso {
  readonly variante: Variante;
  readonly icone: string;
  readonly texto: string;
  /** Instante (ms) em que some. */
  readonly ate: number;
}

/**
 * Tudo que é só de apresentação e muda com o tempo: o renderer recebe isto junto com o
 * estado do jogo. Nada aqui decide regra.
 */
export interface Visual {
  /** Relógio (ms, performance.now()). */
  readonly agora: number;
  /** Posição do hacker em células, fracionária enquanto ele desliza. */
  readonly jogador: Posicao;
  /** Instante (ms) em que cada porta/ponte mudou de estado (anima a abertura). */
  readonly mudancas: ReadonlyMap<string, number>;
  readonly aviso: Aviso | null;
  /** Até quando (ms) a moldura vermelha do alarme fica no mapa. */
  readonly alarmeAte: number;
  /** Instante (ms) da vitória (as estrelas entram uma a uma). */
  readonly vitoriaEm: number;
  /** Tutorial da fase 1-1, ou null quando não está ativo. */
  readonly tutorial: Tutorial | null;
  /** Bancada do Firewall espelhado: valores só para visualizar os cabos. */
  readonly bancada: Valoracao;
  /** A próxima Enter na vitória abre o relatório final (última fase). */
  readonly ultimaFase: boolean;
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
