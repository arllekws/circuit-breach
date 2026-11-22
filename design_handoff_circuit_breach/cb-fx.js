// Circuit Breach — modo invasão. Camadas animadas sobre o renderer base (Canvas 2D, 680×400).
// Regra: código ambiente só em áreas livres (vazios do mapa, fundo do menu/final). Nunca atrás do circuito ou da tabela.
import { FX, C, T, font, rectF, ln, hash, prep, drawCanvas, fontsReady } from './cb-render.js';

const RG = ['0', '1', '¬', '∧', '∨', '⊕', '→', '↔', 'P', 'Q', 'R', 'A', 'B', '⊢', '3F', 'A0', '7E', '1B', 'FF', '0x'];
const F32 = ['P', 'Q', 'R', '→', '∧', '0', '1', 'D1', 'L1', '=', '(', ')'];
const MAPG = { 'fase-dica': F32, 'fase-scan': F32, vitoria: ['P', 'Q', '¬', '∧', '0', '1', 'D1', '='] };
const TK32 = [['> scan D1 :: (P→Q)∧R'], ['  in   P=1  Q=1  R=0'], ['  IMP(1,1) = 1'], ['  AND(1,0) = 0   ✕ porta trancada', C.danger],
  ['> probe L1 :: laser ativo'], ['> alerta 4/6 · 2 estrelas possíveis'], ['> aguardando entrada ...']];
const TICK = { 'fase-dica': TK32, 'fase-scan': TK32,
  vitoria: [['> scan D1 :: ¬P∧Q'], ['  NOT(0) = 1'], ['  AND(1,1) = 1   ✓ porta aberta', C.ok], ['> saída alcançada · 2 trocas'], ['> upload setor 1 ... ok'], ['> abrindo setor 2 · REDE']] };

// chuva de dados: colunas alternam subida/descida, glifos presos ao fluxo (não trocam no lugar)
export function rain(ctx, x, y, w, h, o = {}) {
  const cw = 14, rh = 14, strong = FX.lvl >= 2, G = o.glyphs || RG;
  const body = strong ? C.wall : C.grid, head = strong ? C.border : C.wall, hot = strong ? C.dim : C.border;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); font(ctx, 11, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cols = Math.ceil(w / cw);
  for (let i = 0; i < cols; i++) {
    const s = hash(i + (o.seed || 0) * 101, 7); if (s % 5 === 0) continue;
    const off = FX.t * (8 + s % 22) * (i % 2 ? -1 : 1), cx = x + i * cw + cw / 2;
    const k0 = Math.floor(-off / rh) - 1, k1 = k0 + Math.ceil(h / rh) + 2;
    for (let k = k0; k <= k1; k++) {
      const g = hash(s, k); if (g % 3 === 0) continue;
      ctx.fillStyle = g % 23 === 0 ? hot : g % 7 === 0 ? head : body; ctx.fillText(G[g % G.length], cx, y + k * rh + off);
    }
  }
  ctx.restore();
}
// log de sistema: linha nova é digitada embaixo e empurra as anteriores para cima
function ticker(ctx, x, y, w, h, L) {
  const P = 1.5, rh = 13, t = Math.max(0, FX.t), n = Math.floor(t / P), f = (t % P) / P, rows = Math.floor(h / rh);
  const shift = (1 - Math.min(1, f / 0.18)) * rh;
  ln(ctx, [[x, y - 3], [x + w, y - 3]], C.border, 1, [2, 3]);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = Math.max(0, n - rows); i <= n; i++) {
    const [s, col] = L[i % L.length], yy = y + h - rh / 2 - (n - i) * rh + shift - 1;
    T(ctx, i === n ? s.slice(0, Math.floor(Math.min(1, f * 2.2) * s.length)) : s, x, yy, { size: 11, color: col || C.dim });
  }
  ctx.restore();
}
// pulsos: o valor 1 "corre" pelos fios ciano em direção à porta; fios em 0 ficam parados
function packets(ctx, segs) {
  segs.forEach(sg => {
    if (sg.v !== 1) return; const p = sg.pts, ls = []; let L = 0;
    for (let i = 1; i < p.length; i++) { const d = Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); ls.push(d); L += d; }
    for (let s = (FX.t * 34) % 16; s < L - 2; s += 16) {
      let r = s, i = 0; while (i < ls.length - 1 && r > ls[i]) { r -= ls[i]; i++; }
      const a = p[i], b = p[i + 1], k = ls[i] ? r / ls[i] : 0; rectF(ctx, a[0] + (b[0] - a[0]) * k - 1.5, a[1] + (b[1] - a[1]) * k - 1.5, 3, 3, C.text);
    }
  });
}
FX.hooks.bg = (ctx, w, h, name) => { if (name === 'menu') rain(ctx, 250, 0, 430, 372, { seed: 1 }); else if (name === 'final') rain(ctx, 0, 0, 680, 372, { seed: 2 }); };
FX.hooks.mapVoid = (ctx, x, y, w, h, ly) => { if (ly - y > 14) rain(ctx, x + 1, y + 1, w - 2, ly - y - 1, { seed: 3, glyphs: MAPG[FX.screen] }); };
FX.hooks.mapOver = (ctx, x, y, w, h, ly, lh) => {
  const by = ly + lh, bh = y + h - by;
  if (bh >= 30 && TICK[FX.screen]) ticker(ctx, x + 10, by + 6, w - 20, bh - 10, TICK[FX.screen]);
  if (FX.screen === 'fase-scan' && FX.lvl >= 2) rectF(ctx, x + 30, Math.round(ly + 30 + (FX.t * 30) % (lh - 60)), w - 60, 1, C.dim);
};
FX.hooks.wires = packets;
FX.hooks.menuBus = ctx => { rectF(ctx, 266, 49, 1, 61, C.ok); rectF(ctx, 264, 49 + (FX.t * 40) % 53, 5, 8, C.ok); };

let raf = 0, io = null;
export async function start(opts) {
  Object.assign(FX, opts); FX.on = FX.lvl > 0; await fontsReady();
  if (raf) cancelAnimationFrame(raf); raf = 0; if (io) io.disconnect();
  const cvs = [...document.querySelectorAll('canvas[data-screen]')], vis = new Set(), now0 = performance.now() / 1000;
  io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)));
  const frame = (cv, now) => { FX.t = FX.motion ? (now - cv._t0) * FX.speed : 30; FX.t0 = 0; drawCanvas(cv); };
  cvs.forEach(cv => { prep(cv); if (cv._t0 == null) cv._t0 = now0; cv.style.cursor = 'pointer';
    cv.onclick = () => { cv._t0 = performance.now() / 1000; if (!FX.motion || !FX.on) frame(cv, cv._t0 + 30); };
    io.observe(cv); frame(cv, now0); });
  let last = 0;
  const loop = ms => { raf = requestAnimationFrame(loop); if (ms - last < 33) return; last = ms; vis.forEach(cv => frame(cv, ms / 1000)); };
  if (FX.on && FX.motion) raf = requestAnimationFrame(loop);
}
export function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (io) io.disconnect(); }
