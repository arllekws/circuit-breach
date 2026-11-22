import { altura, type NoExibido, type Operador, type ValorExibido } from './arvore';
import { FX, fx, hash } from './efeitos';
import { C, fonte } from './tema';

// Primitivas e componentes do renderer (porte de design_handoff_circuit_breach/cb-render.js).
// Só retângulos, linhas, círculos, polígonos e texto. Sem gradiente, sombra, blur ou brilho.

export type Ctx = CanvasRenderingContext2D;
export type Ponto = readonly [number, number];
export type Variante = 'default' | 'focus' | 'danger' | 'ok';

const COR_DA_VARIANTE: Readonly<Record<Variante, string>> = {
  default: C.border,
  focus: C.amber,
  danger: C.danger,
  ok: C.ok,
};

// ───────────────────────── texto ─────────────────────────

export interface EstiloDeTexto {
  readonly size?: number;
  readonly bold?: boolean;
  readonly color?: string;
  readonly align?: CanvasTextAlign;
}

/** Escreve uma linha; (x, y) é o meio da altura da linha. Devolve a largura. */
export function T(ctx: Ctx, s: string, x: number, y: number, o: EstiloDeTexto = {}): number {
  ctx.font = fonte(o.size ?? 12, o.bold ?? false);
  ctx.fillStyle = o.color ?? C.text;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

export function W(ctx: Ctx, s: string, size = 12, bold = false): number {
  ctx.font = fonte(size, bold);
  return ctx.measureText(s).width;
}

export function wrapLines(ctx: Ctx, s: string, maxW: number, size = 12, bold = false): string[] {
  ctx.font = fonte(size, bold);
  const linhas: string[] = [];
  let linha = '';
  for (const palavra of s.split(' ')) {
    const tentativa = linha === '' ? palavra : `${linha} ${palavra}`;
    if (ctx.measureText(tentativa).width > maxW && linha !== '') {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = tentativa;
    }
  }
  if (linha !== '') linhas.push(linha);
  return linhas;
}

/** Parágrafo com quebra automática; devolve a altura ocupada. */
export function wrap(ctx: Ctx, s: string, x: number, y: number, maxW: number, o: EstiloDeTexto & { lh?: number } = {}): number {
  const linhas = wrapLines(ctx, s, maxW, o.size ?? 12, o.bold ?? false);
  const lh = o.lh ?? 16;
  linhas.forEach((l, i) => T(ctx, l, x, y + i * lh, o));
  return linhas.length * lh;
}

const GLIFOS = '01¬∧∨⊕→↔#$%&*+=<>?/ABCDEFPQRX';

/** Texto que "descriptografa" da esquerda para a direita (só no modo invasão). */
export function TX(ctx: Ctx, s: string, x: number, y: number, o: EstiloDeTexto = {}, atraso = 0, duracao = 0.7): number {
  const p = (FX.t - FX.t0 - atraso) / duracao;
  if (!FX.ligado || p >= 1) return T(ctx, s, x, y, o);
  const n = Math.max(0, Math.floor(p * s.length));
  const q = Math.floor(FX.t / 0.08);
  const w = W(ctx, s, o.size ?? 12, o.bold ?? false);
  let embaralhado = '';
  for (let i = n; i < s.length; i++) embaralhado += s[i] === ' ' ? ' ' : GLIFOS[hash(i * 31 + (x | 0), q) % GLIFOS.length];
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const pronto = T(ctx, s.slice(0, n), x0, y, { ...o, align: 'left' });
  T(ctx, embaralhado, x0 + pronto, y, { ...o, align: 'left', color: C.dim });
  return w;
}

/** Texto digitado com cursor sólido (sem piscar); alterna as linhas a cada `periodo` s. */
export function TY(ctx: Ctx, linhas: readonly string[], x: number, y: number, o: EstiloDeTexto = {}, periodo = 4, cps = 28): number {
  if (!FX.ligado) return T(ctx, linhas[0] ?? '', x, y, o);
  const tt = Math.max(0, FX.t - FX.t0);
  const s = linhas[Math.floor(tt / periodo) % linhas.length] ?? '';
  const n = Math.min(s.length, Math.floor((tt % periodo) * cps));
  const w = T(ctx, s.slice(0, n), x, y, o);
  if (n < s.length) rectF(ctx, x + w + 1, y - 6, 7, 12, o.color ?? C.text);
  return w;
}

// ───────────────────────── formas ─────────────────────────

export function rectF(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

export function rectS(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string, lw = 1, dash?: number[]): void {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = lw;
  if (dash !== undefined) ctx.setLineDash(dash);
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  ctx.restore();
}

export function caminho(ctx: Ctx, pts: readonly Ponto[], fechar = true): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  if (fechar) ctx.closePath();
}

export function ln(ctx: Ctx, pts: readonly Ponto[], cor: string, lw = 1, dash?: number[], deslocamento = 0): void {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = lw;
  if (dash !== undefined) ctx.setLineDash(dash);
  ctx.lineDashOffset = deslocamento;
  caminho(ctx, pts, false);
  ctx.stroke();
  ctx.restore();
}

/** Contorno com chanfro nos cantos superior direito e inferior esquerdo (assinatura visual). */
const chanfrado = (x: number, y: number, w: number, h: number, c: number): Ponto[] => [
  [x, y],
  [x + w - c, y],
  [x + w, y + c],
  [x + w, y + h],
  [x + c, y + h],
  [x, y + h - c],
];

export function chamfer(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
  preenchimento: string | null,
  contorno: string | null,
  lw = 1,
  dash?: number[],
): void {
  if (preenchimento !== null) {
    ctx.fillStyle = preenchimento;
    caminho(ctx, chanfrado(x, y, w, h, c));
    ctx.fill();
  }
  if (contorno !== null) {
    const i = lw / 2;
    ctx.save();
    ctx.strokeStyle = contorno;
    ctx.lineWidth = lw;
    if (dash !== undefined) ctx.setLineDash(dash);
    caminho(ctx, chanfrado(x + i, y + i, w - lw, h - lw, c));
    ctx.stroke();
    ctx.restore();
  }
}

/** Estrela de 5 pontas: âmbar cheia (ganha / ainda possível) ou contorno cinza (perdida). */
export function estrela(ctx: Ctx, cx: number, cy: number, r: number, cheia: boolean, cor: string = C.amber): void {
  const pts: Ponto[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 1 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  caminho(ctx, pts);
  if (cheia) {
    ctx.fillStyle = cor;
    ctx.fill();
  } else {
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
}

/** Cantoneiras de foco (tutorial, item ao alcance do jogador). */
export function bracket(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string = C.amber, l = 6): void {
  ln(ctx, [[x, y + l], [x, y], [x + l, y]], cor, 2);
  ln(ctx, [[x + w - l, y], [x + w, y], [x + w, y + l]], cor, 2);
  ln(ctx, [[x + w, y + h - l], [x + w, y + h], [x + w - l, y + h]], cor, 2);
  ln(ctx, [[x + l, y + h], [x, y + h], [x, y + h - l]], cor, 2);
}

export function cadeado(ctx: Ctx, cx: number, cy: number, cor: string): void {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 3.5, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
  rectF(ctx, cx - 5, cy - 2, 10, 8, cor);
}

// ───────────────────────── painéis, botões, teclas ─────────────────────────

/** Aba do cabeçalho de um painel. Devolve a largura. */
export function tab(ctx: Ctx, x: number, y: number, rotulo: string, v: Variante = 'default'): number {
  const w = Math.ceil(W(ctx, rotulo, 11, true)) + 12;
  ctx.fillStyle = COR_DA_VARIANTE[v];
  caminho(ctx, [[x, y], [x + w + 8, y], [x + w, y + 16], [x, y + 16]]);
  ctx.fill();
  T(ctx, rotulo, x + 6, y + 8.5, { size: 11, bold: true, color: v === 'default' ? C.text : C.ink });
  return w + 8;
}

export interface OpcoesDoPainel {
  readonly v?: Variante;
  readonly title?: string;
  readonly meta?: string;
  readonly metaColor?: string;
  readonly metaBold?: boolean;
  readonly fill?: string;
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, o: OpcoesDoPainel = {}): void {
  const v = o.v ?? 'default';
  chamfer(ctx, x, y, w, h, 8, o.fill ?? C.panel, COR_DA_VARIANTE[v], v === 'default' ? 1 : 2);
  if (o.title !== undefined) tab(ctx, x, y, o.title, v);
  if (o.meta !== undefined) {
    T(ctx, o.meta, x + w - 12, y + 9, { size: 11, bold: o.metaBold ?? false, color: o.metaColor ?? C.dim, align: 'right' });
  }
}

const larguraDaTecla = (ctx: Ctx, k: string): number => Math.max(16, Math.ceil(W(ctx, k, 11, true)) + 8);

/** Tecla desenhada (altura 16), com linha inferior de "profundidade". Devolve a largura. */
export function key(ctx: Ctx, x: number, y: number, k: string, cor: string = C.dim): number {
  const w = larguraDaTecla(ctx, k);
  rectF(ctx, x, y, w, 16, C.map);
  rectS(ctx, x, y, w, 16, cor);
  rectF(ctx, x + 1, y + 14, w - 2, 1, cor);
  T(ctx, k, x + w / 2, y + 7.5, { size: 11, bold: true, align: 'center' });
  return w;
}

export type Teclas = string | readonly string[];
const comoLista = (k: Teclas): readonly string[] => (typeof k === 'string' ? [k] : k);

const larguraDaDica = (ctx: Ctx, k: Teclas, rotulo: string): number =>
  comoLista(k).reduce((s, kk) => s + larguraDaTecla(ctx, kk) + 3, 0) + 2 + (rotulo !== '' ? W(ctx, rotulo, 11) : 0);

export function keyHint(ctx: Ctx, x: number, y: number, k: Teclas, rotulo: string, cor?: string): number {
  let xx = x;
  for (const kk of comoLista(k)) xx += key(ctx, xx, y, kk) + 3;
  xx += 2;
  if (rotulo !== '') xx += T(ctx, rotulo, xx, y + 8.5, { size: 11, color: cor ?? C.dim });
  return xx - x;
}

export type ItemDoRodape = readonly [Teclas, string];

/** Rodapé de controles: teclas + rótulo, centralizado em y 380. */
export function footer(ctx: Ctx, itens: readonly ItemDoRodape[], y = 380): void {
  const vao = 16;
  const larguras = itens.map(([k, r]) => larguraDaDica(ctx, k, r));
  const total = larguras.reduce((a, b) => a + b, 0) + vao * (itens.length - 1);
  let x = Math.round(340 - total / 2);
  itens.forEach(([k, r], n) => {
    keyHint(ctx, x, y, k, r);
    x += (larguras[n] ?? 0) + vao;
  });
}

export type EstadoDoBotao = 'default' | 'selected' | 'disabled' | 'confirm' | 'danger';

const BOTAO: Readonly<Record<EstadoDoBotao, readonly [string, string | null, number, string]>> = {
  default: [C.map, C.border, 1, C.text],
  selected: [C.map, C.amber, 2, C.amber],
  disabled: [C.bg, C.border, 1, C.dim],
  confirm: [C.ok, null, 0, C.ink],
  danger: [C.map, C.danger, 2, C.danger],
};

export function button(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rotulo: string,
  s: EstadoDoBotao = 'default',
  o: { key?: string; size?: number } = {},
): void {
  const [fundo, borda, lw, cor] = BOTAO[s];
  chamfer(ctx, x, y, w, h, 5, fundo, borda, lw, s === 'disabled' ? [3, 3] : undefined);
  let kw = 0;
  if (o.key !== undefined) {
    kw = larguraDaTecla(ctx, o.key) + 8;
    key(ctx, x + w - kw, y + (h - 16) / 2, o.key, s === 'confirm' ? C.ink : C.dim);
  }
  T(ctx, (s === 'selected' ? '▸ ' : '') + rotulo, x + (w - kw) / 2, y + h / 2 + 0.5, {
    size: o.size ?? 12,
    bold: true,
    color: cor,
    align: 'center',
  });
}

/** Mensagem curta (24 px de altura) com ícone na cor da variante. */
export function toast(ctx: Ctx, x: number, y: number, w: number, v: Variante, icone: string, texto: string): void {
  chamfer(ctx, x, y, w, 24, 5, C.panel, COR_DA_VARIANTE[v], 1);
  rectF(ctx, x + 4, y + 4, 16, 16, v === 'default' ? C.border : COR_DA_VARIANTE[v]);
  T(ctx, icone, x + 12, y + 12.5, { size: 11, bold: true, color: v === 'default' ? C.text : C.ink, align: 'center' });
  T(ctx, texto, x + 28, y + 12.5, { size: 11, bold: true });
}

// ───────────────────────── componentes lógicos ─────────────────────────

/** Valor lógico: 1 = ciano cheio, 0 = contorno, '?' = tracejado. */
export function val(ctx: Ctx, x: number, y: number, v: ValorExibido, s = 18, fs?: number): void {
  const tamanho = fs ?? Math.max(11, Math.round(s * 0.66));
  if (v === 1) {
    rectF(ctx, x, y, s, s, C.one);
    T(ctx, '1', x + s / 2, y + s / 2 + 0.5, { size: tamanho, bold: true, color: C.ink, align: 'center' });
  } else if (v === 0) {
    rectF(ctx, x, y, s, s, C.map);
    rectS(ctx, x, y, s, s, C.zero, s >= 22 ? 2 : 1);
    T(ctx, '0', x + s / 2, y + s / 2 + 0.5, { size: tamanho, bold: true, align: 'center' });
  } else {
    rectF(ctx, x, y, s, s, C.map);
    rectS(ctx, x, y, s, s, C.dim, 1, [2, 2]);
    T(ctx, '?', x + s / 2, y + s / 2 + 0.5, { size: tamanho, bold: true, color: C.dim, align: 'center' });
  }
}

/** Entrada do circuito: nome | valor (40 × 20). */
export function entrada(ctx: Ctx, x: number, y: number, nome: string, v: ValorExibido): void {
  rectF(ctx, x, y, 40, 20, C.map);
  rectS(ctx, x, y, 40, 20, v === 1 ? C.one : C.zero);
  T(ctx, nome, x + 10, y + 10.5, { size: 12, bold: true, align: 'center' });
  val(ctx, x + 20, y, v, 20, 13);
}

export const OPS: Readonly<Record<Operador, readonly [string, string]>> = {
  not: ['¬', 'NOT'],
  and: ['∧', 'AND'],
  or: ['∨', 'OR'],
  xor: ['⊕', 'XOR'],
  imp: ['→', 'IMPLICA'],
  bic: ['↔', 'BICOND'],
  unk: ['?', '—'],
};

/** Porta lógica: símbolo, nome e chip com o resultado. */
export function gate(ctx: Ctx, x: number, cy: number, op: Operador, v: ValorExibido, o: { w?: number; root?: boolean; sel?: boolean } = {}): void {
  const w = o.w ?? 92;
  const h = o.root === true ? 28 : 22;
  const y = Math.round(cy - h / 2);
  const cor = o.sel === true ? C.amber : v === 1 ? C.one : C.zero;
  rectF(ctx, x, y, w, h, C.map);
  rectS(ctx, x, y, w, h, cor, o.root === true || o.sel === true ? 2 : 1);
  const [simbolo, nome] = OPS[op];
  T(ctx, simbolo, x + 10, cy + 0.5, { size: 14, bold: true, align: 'center' });
  if (w >= 80) T(ctx, nome, x + 21, cy + 0.5, { size: 11, bold: true });
  const s = o.root === true ? 20 : 16;
  val(ctx, x + w - s - 3, Math.round(cy - s / 2), v, s, o.root === true ? 14 : 11);
}

/** Segmento de fio (para os pulsos do modo invasão). */
export interface Fio {
  readonly pts: readonly Ponto[];
  readonly v: ValorExibido;
}

/** Posição de um nó já desenhado: borda direita (x2) e centro vertical (cy). */
export interface NoPosicionado {
  readonly x2: number;
  readonly cy: number;
}

/**
 * Desenha a árvore da esquerda para a direita: folhas empilhadas a cada `rowH` px, a coluna
 * de cada porta é a sua altura, fios ortogonais com cotovelo 6 px antes da porta
 * (2 px ciano se levam 1, 1 px cinza se levam 0, tracejado se '?').
 */
export function circuit(ctx: Ctx, ox: number, oy: number, arvore: NoExibido, o: { gw?: number; gap?: number; rowH?: number } = {}): NoPosicionado {
  const gw = o.gw ?? 92;
  const gap = o.gap ?? 8;
  const rowH = o.rowH ?? 24;
  let linha = 0;
  interface Posto {
    no: NoExibido;
    x: number;
    x2: number;
    cy: number;
    filhos: Posto[];
  }
  const posicionar = (no: NoExibido): Posto => {
    if ('in' in no) {
      const cy = oy + linha * rowH + 10;
      linha++;
      return { no, x: ox, x2: ox + 40, cy, filhos: [] };
    }
    const filhos = no.a.map(posicionar);
    const cy = Math.round(filhos.reduce((s, f) => s + f.cy, 0) / filhos.length);
    const x = ox + 40 + gap + (altura(no) - 1) * (gw + gap);
    return { no, x, x2: x + gw, cy, filhos };
  };
  const raiz = posicionar(arvore);
  const fios: Fio[] = [];
  const corDoFio = (v: ValorExibido): [string, number, number[] | undefined] =>
    v === 1 ? [C.one, 2, undefined] : v === 0 ? [C.zero, 1, undefined] : [C.zero, 1, [2, 2]];
  const ligar = (p: Posto, ehRaiz: boolean): void => {
    const k = p.filhos.length;
    const mx = p.x - 6;
    p.filhos.forEach((f, i) => {
      const py = k === 1 ? p.cy : p.cy + (i === 0 ? -1 : 1) * (ehRaiz ? 7 : 5);
      const pts: Ponto[] = [[f.x2, f.cy], [mx, f.cy], [mx, py], [p.x, py]];
      fios.push({ pts, v: f.no.v });
      const [cor, lw, dash] = corDoFio(f.no.v);
      ln(ctx, pts, cor, lw, dash);
      ligar(f, false);
    });
  };
  ligar(raiz, true);
  fx('fios', ctx, fios);
  const desenhar = (p: Posto, ehRaiz: boolean): void => {
    const no = p.no;
    if ('in' in no) {
      entrada(ctx, p.x, p.cy - 10, no.in, no.v);
      return;
    }
    p.filhos.forEach((f) => desenhar(f, false));
    gate(ctx, p.x, p.cy, no.op, no.v, { root: ehRaiz, w: gw, sel: no.sel === true });
  };
  desenhar(raiz, true);
  return { x2: raiz.x2, cy: raiz.cy };
}

export interface Resultado {
  readonly v: ValorExibido;
  /** O que o elemento precisa (1 para porta/ponte, 0 para laser). */
  readonly meta: 0 | 1;
  readonly estado: string;
  /** "Quanto falta", ex.: "AND: 1 de 2 entradas em 1". */
  readonly falta: string;
  readonly semMeta?: boolean;
}

/** Bloco de resultado: verde com ✓ quando a saída é a meta, vermelho com ✕ quando não é. */
export function resultBlock(ctx: Ctx, x: number, y: number, w: number, r: Resultado): void {
  const certo = r.v === r.meta;
  const cor = certo ? C.ok : C.danger;
  chamfer(ctx, x, y, w, 42, 6, C.map, cor, 1);
  val(ctx, x + 8, y + 8, r.v, 26, 18);
  T(ctx, `${certo ? '✓' : '✕'} ${r.estado}`, x + 42, y + 14, { size: 12, bold: true, color: cor });
  T(ctx, r.falta, x + 42, y + 30, { size: 11, color: C.dim });
  if (r.semMeta !== true) {
    T(ctx, 'META', x + w - 28, y + 14, { size: 11, bold: true, color: C.dim, align: 'right' });
    val(ctx, x + w - 24, y + 6, r.meta, 16, 11);
  }
}

export interface TabelaExibida {
  readonly vars: readonly string[];
  /** Linhas: valores das proposições e a saída. */
  readonly rows: readonly (readonly [readonly (0 | 1)[], 0 | 1])[];
  readonly goal: 0 | 1;
  /** Índice da linha atual (valoração do jogo). */
  readonly cur: number;
  readonly head?: string;
  readonly rh?: number;
}

/** Tabela-verdade do Scanner: ▸ ATUAL em âmbar, ◂ ALVO contornada em verde. */
export function truth(ctx: Ctx, x: number, y: number, t: TabelaExibida): number {
  const n = t.vars.length;
  const cw = 20;
  const rh = t.rh ?? 14;
  const xo = x + 20 + n * cw + 24;
  const tagX = xo + 26;
  const rw = xo + 16 - (x + 10);
  t.vars.forEach((v, i) => T(ctx, v, x + 20 + i * cw, y, { size: 11, bold: true, color: C.dim, align: 'center' }));
  T(ctx, t.head ?? 'SAÍDA', xo, y, { size: 11, bold: true, color: C.dim, align: 'center' });
  rectF(ctx, x + 10, y + 8, rw, 1, C.border);
  t.rows.forEach(([valores, saida], i) => {
    const ry = y + 18 + i * rh;
    const alvo = saida === t.goal;
    const atual = i === t.cur;
    if (atual) {
      rectF(ctx, x + 10, ry - rh / 2, rw, rh, C.grid);
      T(ctx, '▸', x + 2, ry, { size: 11, bold: true, color: C.amber });
    }
    if (alvo) rectS(ctx, x + 10, ry - rh / 2, rw, rh, C.ok);
    valores.forEach((b, j) => T(ctx, String(b), x + 20 + j * cw, ry + 0.5, { size: 11, bold: true, color: b === 1 ? C.one : C.dim, align: 'center' }));
    T(ctx, String(saida), xo, ry + 0.5, { size: 11, bold: true, color: saida === 1 ? C.one : C.dim, align: 'center' });
    if (alvo) T(ctx, atual ? '◂ ALVO · ATUAL' : '◂ ALVO', tagX, ry + 0.5, { size: 11, bold: true, color: C.ok });
    else if (atual) T(ctx, '◂ ATUAL', tagX, ry + 0.5, { size: 11, bold: true, color: C.amber });
  });
  return 18 + t.rows.length * rh;
}

/** Balão do tutorial: borda âmbar, aba "PASSO n/6", linha até o alvo. Devolve a altura. */
export function callout(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  o: { passo: string; texto: string; teclas?: ItemDoRodape; de?: Ponto; ate?: Ponto },
): number {
  const linhas = wrapLines(ctx, o.texto, w - 20, 12);
  const h = 32 + linhas.length * 16 + (o.teclas !== undefined ? 22 : 0);
  if (o.de !== undefined && o.ate !== undefined) {
    ln(ctx, [o.de, o.ate], C.amber, 1.5);
    rectF(ctx, o.ate[0] - 2.5, o.ate[1] - 2.5, 5, 5, C.amber);
  }
  chamfer(ctx, x, y, w, h, 6, C.panel, C.amber, 1);
  tab(ctx, x, y, o.passo, 'focus');
  linhas.forEach((l, i) => T(ctx, l, x + 10, y + 30 + i * 16, { size: 12 }));
  if (o.teclas !== undefined) keyHint(ctx, x + 10, y + h - 24, o.teclas[0], o.teclas[1], C.text);
  return h;
}
