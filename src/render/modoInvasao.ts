import { FX, hash } from './efeitos';
import type { Retangulo } from './layout';
import { TELA } from './layout';
import { ln, rectF, rectS, T, W, type Ctx, type Fio } from './primitivas';
import { C, fonte } from './tema';

// Modo invasão (porte de cb-fx.js): animações ambientes OPCIONAIS. Só desenham em áreas
// livres (vazios do mapa, fundo do menu e da tela final), nunca atrás do circuito ou da
// tabela. Ligar/desligar: tecla M (desligado por padrão — use desligado no telão).

const GLIFOS = ['0', '1', '¬', '∧', '∨', '⊕', '→', '↔', 'P', 'Q', 'R', 'A', 'B', '⊢', '3F', 'A0', '7E', '1B', 'FF', '0x'];

/** Chuva de dados: colunas alternam subida e descida; os glifos acompanham o fluxo. */
function chuva(ctx: Ctx, x: number, y: number, w: number, h: number, semente: number, glifos: readonly string[] = GLIFOS): void {
  const cw = 14;
  const rh = 14;
  const forte = FX.nivel >= 2;
  const corpo = forte ? C.wall : C.grid;
  const cabeca = forte ? C.border : C.wall;
  const quente = forte ? C.dim : C.border;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.font = fonte(11, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const colunas = Math.ceil(w / cw);
  for (let i = 0; i < colunas; i++) {
    const s = hash(i + semente * 101, 7);
    if (s % 5 === 0) continue;
    const desloc = FX.t * (8 + (s % 22)) * (i % 2 === 1 ? -1 : 1);
    const cx = x + i * cw + cw / 2;
    const k0 = Math.floor(-desloc / rh) - 1;
    const k1 = k0 + Math.ceil(h / rh) + 2;
    for (let k = k0; k <= k1; k++) {
      const g = hash(s, k);
      if (g % 3 === 0) continue;
      ctx.fillStyle = g % 23 === 0 ? quente : g % 7 === 0 ? cabeca : corpo;
      ctx.fillText(glifos[g % glifos.length] ?? '0', cx, y + k * rh + desloc);
    }
  }
  ctx.restore();
}

/** Log de sistema: uma linha nova a cada 1,5 s, digitada embaixo, empurrando as anteriores. */
function registro(ctx: Ctx, x: number, y: number, w: number, h: number, linhas: readonly (readonly [string, string?])[]): void {
  if (linhas.length === 0) return;
  const periodo = 1.5;
  const rh = 13;
  const t = Math.max(0, FX.t);
  const n = Math.floor(t / periodo);
  const f = (t % periodo) / periodo;
  const visiveis = Math.floor(h / rh);
  const subida = (1 - Math.min(1, f / 0.18)) * rh;
  ln(ctx, [[x, y - 3], [x + w, y - 3]], C.border, 1, [2, 3]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = Math.max(0, n - visiveis); i <= n; i++) {
    const [texto, cor] = linhas[i % linhas.length] ?? [''];
    const yy = y + h - rh / 2 - (n - i) * rh + subida - 1;
    const mostrado = i === n ? texto.slice(0, Math.floor(Math.min(1, f * 2.2) * texto.length)) : texto;
    T(ctx, mostrado, x, yy, { size: 11, color: cor ?? C.dim });
    if (i === n && mostrado.length < texto.length) {
      const cw = W(ctx, mostrado, 11);
      rectF(ctx, x + cw + 2, yy - 5, 6, 10, cor ?? C.term);
    }
  }
  ctx.restore();
}

/** Pulsos: o valor 1 "corre" pelos fios ciano em direção à porta; fios em 0 ficam parados. */
function pulsos(ctx: Ctx, fios: readonly Fio[]): void {
  for (const fio of fios) {
    if (fio.v !== 1) continue;
    const p = fio.pts;
    const trechos: number[] = [];
    let total = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1] as readonly [number, number];
      const b = p[i] as readonly [number, number];
      const d = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      trechos.push(d);
      total += d;
    }
    for (let s = (FX.t * 34) % 16; s < total - 2; s += 16) {
      let resto = s;
      let i = 0;
      while (i < trechos.length - 1 && resto > (trechos[i] ?? 0)) resto -= trechos[i++] ?? 0;
      const a = p[i] as readonly [number, number];
      const b = p[i + 1] as readonly [number, number];
      const k = (trechos[i] ?? 0) > 0 ? resto / (trechos[i] ?? 1) : 0;
      rectF(ctx, a[0] + (b[0] - a[0]) * k - 1.5, a[1] + (b[1] - a[1]) * k - 1.5, 3, 3, C.text);
    }
  }
}

function scanlines(ctx: Ctx): void {
  const alpha = FX.nivel >= 2 ? 0.08 : 0.045;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = 0; y < TELA.h; y += 3) rectF(ctx, 0, y, TELA.w, 1, C.crt);
  ctx.restore();
  if (FX.nivel >= 2) {
    const y = (FX.t * 42) % TELA.h;
    ctx.save();
    ctx.globalAlpha = 0.06;
    rectF(ctx, 0, y, TELA.w, 2, C.term);
    ctx.restore();
  }
}

function vinheta(ctx: Ctx): void {
  const a = FX.nivel >= 2 ? 0.14 : 0.08;
  ctx.save();
  ctx.globalAlpha = a;
  rectF(ctx, 0, 0, TELA.w, 10, C.bg);
  rectF(ctx, 0, TELA.h - 10, TELA.w, 10, C.bg);
  rectF(ctx, 0, 0, 10, TELA.h, C.bg);
  rectF(ctx, TELA.w - 10, 0, 10, TELA.h, C.bg);
  ctx.restore();
}

function glitch(ctx: Ctx): void {
  if (!FX.glitch) return;
  const faixas = FX.nivel >= 2 ? 4 : 2;
  ctx.save();
  for (let i = 0; i < faixas; i++) {
    const y = hash(i, Math.floor(FX.t * 20)) % (TELA.h - 8);
    const h = 2 + (hash(i, 99) % 4);
    ctx.globalAlpha = 0.08;
    rectF(ctx, 0, y, TELA.w, h, C.term);
    ctx.globalAlpha = 0.05;
    rectF(ctx, (hash(i, 7) % 18) - 9, y + 1, TELA.w, 1, C.one);
  }
  ctx.restore();
}

function overlayTerminal(ctx: Ctx): void {
  scanlines(ctx);
  vinheta(ctx);
  glitch(ctx);
  if (FX.nivel >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    rectS(ctx, 1, 1, TELA.w - 2, TELA.h - 2, C.border, 1);
    ctx.restore();
  }
}

FX.ganchos['fundo'] = ((ctx: Ctx, tela: string) => {
  if (tela === 'menu' || tela === 'boot') chuva(ctx, 250, 0, 430, 372, 1);
  else if (tela === 'final') chuva(ctx, 0, 0, 680, 372, 2);
}) as never;

FX.ganchos['vazioDoMapa'] = ((ctx: Ctx, area: Retangulo, ly: number, _lh: number, glifos?: readonly string[]) => {
  if (ly - area.y > 14) chuva(ctx, area.x + 1, area.y + 1, area.w - 2, ly - area.y - 1, 3, glifos);
}) as never;

FX.ganchos['sobreOMapa'] = ((ctx: Ctx, area: Retangulo, ly: number, lh: number, linhas: readonly (readonly [string, string?])[]) => {
  const baixo = ly + lh;
  const sobra = area.y + area.h - baixo;
  if (sobra >= 30) registro(ctx, area.x + 10, baixo + 6, area.w - 20, sobra - 10, linhas);
}) as never;

FX.ganchos['fios'] = pulsos as never;

FX.ganchos['barramento'] = ((ctx: Ctx) => {
  rectF(ctx, 264, 45 + ((FX.t * 40) % 280), 5, 8, C.ok);
}) as never;

FX.ganchos['overlay'] = overlayTerminal as never;
