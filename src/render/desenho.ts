import type { Retangulo } from './layout';
import { CORES, fonte } from './tema';

// Primitivas de desenho compartilhadas. Só formas chapadas: sem gradiente, sombra ou brilho.

export type Ctx = CanvasRenderingContext2D;

export function preencher(ctx: Ctx, r: Retangulo, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

export function contornar(ctx: Ctx, r: Retangulo, cor: string, espessura = 1, tracejado: number[] = []): void {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.setLineDash(tracejado);
  // Meio pixel para dentro: a linha fica nítida e não vaza do retângulo.
  ctx.strokeRect(r.x + espessura / 2, r.y + espessura / 2, r.w - espessura, r.h - espessura);
  ctx.restore();
}

export interface EstiloDeTexto {
  readonly cor?: string;
  readonly tamanho?: number;
  readonly negrito?: boolean;
  readonly alinhar?: CanvasTextAlign;
}

/** Escreve uma linha de texto; (x, y) é o ponto de ancoragem na altura do meio da linha. */
export function escrever(ctx: Ctx, texto: string, x: number, y: number, estilo: EstiloDeTexto = {}): void {
  ctx.font = fonte(estilo.tamanho, estilo.negrito);
  ctx.fillStyle = estilo.cor ?? CORES.texto;
  ctx.textAlign = estilo.alinhar ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x, y);
}

/** Quebra o texto em linhas que cabem na largura dada (usa a fonte do estilo). */
export function quebrarTexto(ctx: Ctx, texto: string, largura: number, estilo: EstiloDeTexto = {}): string[] {
  ctx.font = fonte(estilo.tamanho, estilo.negrito);
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual === '' ? palavra : `${atual} ${palavra}`;
    if (atual !== '' && ctx.measureText(tentativa).width > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual !== '') linhas.push(atual);
  return linhas;
}

/** Escreve um parágrafo com quebra automática; devolve o y logo abaixo da última linha. */
export function escreverParagrafo(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  largura: number,
  estilo: EstiloDeTexto = {},
  entrelinha = 15,
): number {
  let yLinha = y;
  for (const linha of quebrarTexto(ctx, texto, largura, estilo)) {
    escrever(ctx, linha, x, yLinha, estilo);
    yLinha += entrelinha;
  }
  return yLinha;
}

export function linha(ctx: Ctx, pontos: readonly (readonly [number, number])[], cor: string, espessura = 1, tracejado: number[] = []): void {
  const [primeiro, ...resto] = pontos;
  if (primeiro === undefined) return;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.setLineDash(tracejado);
  ctx.beginPath();
  ctx.moveTo(primeiro[0], primeiro[1]);
  for (const [x, y] of resto) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

export function circulo(ctx: Ctx, x: number, y: number, raio: number, preenchimento: string | null, contorno: string | null = null, espessura = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  if (preenchimento !== null) {
    ctx.fillStyle = preenchimento;
    ctx.fill();
  }
  if (contorno !== null) {
    ctx.strokeStyle = contorno;
    ctx.lineWidth = espessura;
    ctx.stroke();
  }
}

/** Estrela de 5 pontas: preenchida (ganha) ou só contorno (não ganha). */
export function estrela(ctx: Ctx, x: number, y: number, raio: number, cheia: boolean, cor: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.45;
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + r * Math.cos(angulo), y + r * Math.sin(angulo));
  }
  ctx.closePath();
  if (cheia) {
    ctx.fillStyle = cor;
    ctx.fill();
  } else {
    ctx.strokeStyle = cor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
