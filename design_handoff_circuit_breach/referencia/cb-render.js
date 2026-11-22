// Circuit Breach — renderer de referência. Canvas 2D puro, resolução lógica 680×400.
// Só retângulos, linhas, círculos, polígonos e texto. Sem gradientes, sombras ou brilho.
export const C = {
  bg: '#0A111A', map: '#0E1621', grid: '#162434', wall: '#243447', panel: '#101B28', border: '#2A3E52',
  one: '#2DD4BF', zero: '#6B8499', danger: '#E5484D', ok: '#3DD68C', amber: '#F5B342', text: '#CFE3F2', dim: '#6B8499', ink: '#0A111A'
};
const VAR = { default: C.border, focus: C.amber, danger: C.danger, ok: C.ok };
const FF = '"JetBrains Mono", ui-monospace, Menlo, monospace';
// Camada de efeitos (modo invasão). Desligada por padrão: sem FX.on as telas ficam estáticas.
export const FX = { on: false, t: 0, t0: 0, lvl: 0, speed: 1, motion: true, screen: '', hooks: {} };
const fx = (n, ...a) => { if (FX.on && FX.hooks[n]) FX.hooks[n](...a); };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

/* ---------- primitivas ---------- */
export const font = (ctx, s = 12, b = false) => { ctx.font = `${b ? 700 : 400} ${s}px ${FF}`; };
export function T(ctx, s, x, y, o = {}) {
  font(ctx, o.size || 12, o.bold); ctx.fillStyle = o.color || C.text;
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}
export const W = (ctx, s, size = 12, b = false) => { font(ctx, size, b); return ctx.measureText(s).width; };
export function wrapLines(ctx, s, maxW, size = 12, bold = false) {
  font(ctx, size, bold); const out = []; let line = '';
  s.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
  if (line) out.push(line); return out;
}
export function wrap(ctx, s, x, y, maxW, o = {}) {
  const ls = wrapLines(ctx, s, maxW, o.size || 12, o.bold), lh = o.lh || 16;
  ls.forEach((l, i) => T(ctx, l, x, y + i * lh, o)); return ls.length * lh;
}
const GL = '01¬∧∨⊕→↔#$%&*+=<>?/ABCDEFPQRX';
// texto "descriptografado": glifos aleatórios resolvem da esquerda p/ direita
export function TX(ctx, s, x, y, o = {}, delay = 0, dur = 0.7) {
  const p = (FX.t - FX.t0 - delay) / dur;
  if (!FX.on || p >= 1) return T(ctx, s, x, y, o);
  const n = Math.max(0, Math.floor(p * s.length)), q = Math.floor(FX.t / 0.08), w = W(ctx, s, o.size || 12, o.bold);
  let sc = ''; for (let i = n; i < s.length; i++) sc += s[i] === ' ' ? ' ' : GL[hash(i * 31 + (x | 0), q) % GL.length];
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const rw = T(ctx, s.slice(0, n), x0, y, Object.assign({}, o, { align: 'left' }));
  T(ctx, sc, x0 + rw, y, Object.assign({}, o, { align: 'left', color: C.dim })); return w;
}
// texto digitado (cursor sólido enquanto digita, sem piscar); period=Infinity digita uma vez
export function TY(ctx, lines, x, y, o = {}, period = 4, cps = 28) {
  if (!FX.on) return T(ctx, lines[0], x, y, o);
  const tt = Math.max(0, FX.t - FX.t0), s = lines[Math.floor(tt / period) % lines.length], n = Math.min(s.length, Math.floor((tt % period) * cps));
  const w = T(ctx, s.slice(0, n), x, y, o); if (n < s.length) rectF(ctx, x + w + 1, y - 6, 7, 12, o.color || C.text); return w;
}
export const rectF = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
export function rectS(ctx, x, y, w, h, c, lw = 1, dash) {
  ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); ctx.restore();
}
export function path(ctx, pts, close = true) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (close) ctx.closePath(); }
export function ln(ctx, pts, c, lw = 1, dash, off) { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); if (off) ctx.lineDashOffset = off; path(ctx, pts, false); ctx.stroke(); ctx.restore(); }
// chanfro no canto superior direito e inferior esquerdo (assinatura visual)
const cham = (x, y, w, h, c) => [[x, y], [x + w - c, y], [x + w, y + c], [x + w, y + h], [x + c, y + h], [x, y + h - c]];
export function chamfer(ctx, x, y, w, h, c, fill, stroke, lw = 1, dash) {
  if (fill) { ctx.fillStyle = fill; path(ctx, cham(x, y, w, h, c)); ctx.fill(); }
  if (stroke) { const i = lw / 2; ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); path(ctx, cham(x + i, y + i, w - lw, h - lw, c)); ctx.stroke(); ctx.restore(); }
}
export function star(ctx, cx, cy, r, filled, col = C.amber) {
  const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  path(ctx, p); if (filled) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = C.dim; ctx.lineWidth = 1.25; ctx.stroke(); }
}
export function bracket(ctx, x, y, w, h, col = C.amber, l = 6) {
  ln(ctx, [[x, y + l], [x, y], [x + l, y]], col, 2); ln(ctx, [[x + w - l, y], [x + w, y], [x + w, y + l]], col, 2);
  ln(ctx, [[x + w, y + h - l], [x + w, y + h], [x + w - l, y + h]], col, 2); ln(ctx, [[x + l, y + h], [x, y + h], [x, y + h - l]], col, 2);
}
export function lock(ctx, cx, cy, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy - 2, 3.5, Math.PI, 0); ctx.stroke(); ctx.restore();
  rectF(ctx, cx - 5, cy - 2, 10, 8, col);
}

/* ---------- painéis, botões, teclas ---------- */
export function tab(ctx, x, y, label, v = 'default') {
  const w = Math.ceil(W(ctx, label, 11, true)) + 12;
  ctx.fillStyle = VAR[v]; path(ctx, [[x, y], [x + w + 8, y], [x + w, y + 16], [x, y + 16]]); ctx.fill();
  T(ctx, label, x + 6, y + 8.5, { size: 11, bold: true, color: v === 'default' ? C.text : C.ink }); return w + 8;
}
export function panel(ctx, x, y, w, h, o = {}) {
  const v = o.v || 'default', lw = o.lw || (v === 'default' ? 1 : 2);
  chamfer(ctx, x, y, w, h, o.c ?? 8, o.fill || C.panel, VAR[v], lw);
  if (o.title) tab(ctx, x, y, o.title, v);
  if (o.meta) T(ctx, o.meta, x + w - 12, y + 9, { size: 11, bold: !!o.metaBold, color: o.metaColor || C.dim, align: 'right' });
}
const capW = (ctx, k) => Math.max(16, Math.ceil(W(ctx, k, 11, true)) + 8);
export function key(ctx, x, y, k, col = C.dim) {
  const w = capW(ctx, k); rectF(ctx, x, y, w, 16, C.map); rectS(ctx, x, y, w, 16, col); rectF(ctx, x + 1, y + 14, w - 2, 1, col);
  T(ctx, k, x + w / 2, y + 7.5, { size: 11, bold: true, align: 'center' }); return w;
}
const hintW = (ctx, k, l) => [].concat(k).reduce((s, kk) => s + capW(ctx, kk) + 3, 0) + 2 + (l ? W(ctx, l, 11) : 0);
export function keyHint(ctx, x, y, k, l, col) {
  let xx = x; [].concat(k).forEach(kk => { xx += key(ctx, xx, y, kk) + 3; }); xx += 2;
  if (l) xx += T(ctx, l, xx, y + 8.5, { size: 11, color: col || C.dim }); return xx - x;
}
export function footer(ctx, items, y = 380) {
  const g = 16, ws = items.map(i => hintW(ctx, i[0], i[1])); const tot = ws.reduce((a, b) => a + b, 0) + g * (items.length - 1);
  let x = Math.round(340 - tot / 2); items.forEach((i, n) => { keyHint(ctx, x, y, i[0], i[1]); x += ws[n] + g; });
}
const BTN = { default: [C.map, C.border, 1, C.text], selected: [C.map, C.amber, 2, C.amber], disabled: [C.bg, C.border, 1, C.dim], confirm: [C.ok, null, 0, C.ink], danger: [C.map, C.danger, 2, C.danger] };
export function button(ctx, x, y, w, h, label, s = 'default', o = {}) {
  const st = BTN[s]; chamfer(ctx, x, y, w, h, 5, st[0], st[1], st[2], s === 'disabled' ? [3, 3] : null);
  let kw = 0; if (o.key) { kw = capW(ctx, o.key) + 8; key(ctx, x + w - kw, y + (h - 16) / 2, o.key, s === 'confirm' ? C.ink : C.dim); }
  const lab = (s === 'selected' ? '▸ ' : '') + label;
  T(ctx, lab, x + (w - kw) / 2, y + h / 2 + .5, { size: o.size || 12, bold: true, color: st[3], align: 'center' });
}
export function toast(ctx, x, y, w, v, icon, text) {
  chamfer(ctx, x, y, w, 24, 5, C.panel, VAR[v], 1); rectF(ctx, x + 4, y + 4, 16, 16, v === 'default' ? C.border : VAR[v]);
  T(ctx, icon, x + 12, y + 12.5, { size: 11, bold: true, color: v === 'default' ? C.text : C.ink, align: 'center' });
  T(ctx, text, x + 28, y + 12.5, { size: 11, bold: true });
}

/* ---------- componentes lógicos ---------- */
export function val(ctx, x, y, v, s = 18, fs) {
  fs = fs || Math.max(11, Math.round(s * 0.66));
  if (v === 1) { rectF(ctx, x, y, s, s, C.one); T(ctx, '1', x + s / 2, y + s / 2 + .5, { size: fs, bold: true, color: C.ink, align: 'center' }); }
  else if (v === 0) { rectF(ctx, x, y, s, s, C.map); rectS(ctx, x, y, s, s, C.zero, s >= 22 ? 2 : 1); T(ctx, '0', x + s / 2, y + s / 2 + .5, { size: fs, bold: true, align: 'center' }); }
  else { rectF(ctx, x, y, s, s, C.map); rectS(ctx, x, y, s, s, C.dim, 1, [2, 2]); T(ctx, '?', x + s / 2, y + s / 2 + .5, { size: fs, bold: true, color: C.dim, align: 'center' }); }
}
export function input(ctx, x, y, name, v) {
  rectF(ctx, x, y, 40, 20, C.map); rectS(ctx, x, y, 40, 20, v === 1 ? C.one : C.zero);
  T(ctx, name, x + 10, y + 10.5, { size: 12, bold: true, align: 'center' }); val(ctx, x + 20, y, v, 20, 13);
}
const OPS = { not: ['¬', 'NOT'], and: ['∧', 'AND'], or: ['∨', 'OR'], xor: ['⊕', 'XOR'], imp: ['→', 'IMPLICA'], bic: ['↔', 'BICOND'], unk: ['?', '—'] };
export function gate(ctx, x, cy, op, v, o = {}) {
  const w = o.w || 92, h = o.root ? 28 : 22, y = Math.round(cy - h / 2), col = o.sel ? C.amber : v === 1 ? C.one : C.zero;
  rectF(ctx, x, y, w, h, C.map); rectS(ctx, x, y, w, h, col, o.root || o.sel ? 2 : 1);
  const [sym, name] = OPS[op];
  T(ctx, sym, x + 10, cy + .5, { size: 14, bold: true, align: 'center' });
  if (w >= 80) T(ctx, name, x + 21, cy + .5, { size: 11, bold: true });
  const s = o.root ? 20 : 16; val(ctx, x + w - s - 3, Math.round(cy - s / 2), v, s, o.root ? 14 : 11);
}
// árvore lógica esquerda → direita. nós: {in:'P', v} | {op, v, a:[...]}
export function circuit(ctx, ox, oy, tree, o = {}) {
  const gw = o.gw || 92, gap = o.gap || 8, rowH = o.rowH || 24; let row = 0;
  const lay = n => { if (n.in !== undefined) { n.h = 0; n.cy = oy + row * rowH + 10; row++; n.x = ox; n.x2 = ox + 40; return; }
    n.a.forEach(lay); n.h = 1 + Math.max(...n.a.map(c => c.h)); n.cy = Math.round(n.a.reduce((s, c) => s + c.cy, 0) / n.a.length); };
  lay(tree); tree.root = true;
  const place = n => { if (n.in !== undefined) return; n.x = ox + 40 + gap + (n.h - 1) * (gw + gap); n.x2 = n.x + gw; n.a.forEach(place); }; place(tree);
  const segs = []; const wires = n => { if (n.in !== undefined) return; const k = n.a.length, mx = n.x - 6;
    n.a.forEach((c, i) => { const py = k === 1 ? n.cy : n.cy + (i === 0 ? -1 : 1) * (n.root ? 7 : 5);
      const pts = [[c.x2, c.cy], [mx, c.cy], [mx, py], [n.x, py]]; segs.push({ pts, v: c.v }); ln(ctx, pts, c.v === 1 ? C.one : C.zero, c.v === 1 ? 2 : 1, c.v === 1 || c.v === 0 ? null : [2, 2]); wires(c); }); };
  wires(tree); fx('wires', ctx, segs);
  const nodes = n => { if (n.in !== undefined) { input(ctx, n.x, n.cy - 10, n.in, n.v); return; } n.a.forEach(nodes); gate(ctx, n.x, n.cy, n.op, n.v, { root: n.root, w: gw, sel: n.sel }); };
  nodes(tree); return tree;
}
export function resultBlock(ctx, x, y, w, r) {
  const ok = r.v === r.goal, col = ok ? C.ok : C.danger;
  chamfer(ctx, x, y, w, 42, 6, C.map, col, 1); val(ctx, x + 8, y + 8, r.v, 26, 18);
  T(ctx, (ok ? '✓ ' : '✕ ') + r.state, x + 42, y + 14, { size: 12, bold: true, color: col });
  T(ctx, r.need, x + 42, y + 30, { size: 11, color: C.dim });
  if (!r.noMeta) { T(ctx, 'META', x + w - 28, y + 14, { size: 11, bold: true, color: C.dim, align: 'right' }); val(ctx, x + w - 24, y + 6, r.goal, 16, 11); }
}
export function truth(ctx, x, y, t) {
  const n = t.vars.length, cw = t.cw || 20, rh = t.rh || 14, xo = x + 20 + n * cw + 24, tagX = xo + 26, rw = xo + 16 - (x + 10);
  t.vars.forEach((v, i) => T(ctx, v, x + 20 + i * cw, y, { size: 11, bold: true, color: C.dim, align: 'center' }));
  T(ctx, t.head || 'SAÍDA', xo, y, { size: 11, bold: true, color: C.dim, align: 'center' });
  rectF(ctx, x + 10, y + 8, rw, 1, C.border);
  t.rows.forEach((r, i) => {
    const ry = y + 18 + i * rh, tgt = r[1] === t.goal, cur = i === t.cur;
    if (cur) { rectF(ctx, x + 10, ry - rh / 2, rw, rh, C.grid); T(ctx, '▸', x + 2, ry, { size: 11, bold: true, color: C.amber }); }
    if (tgt) rectS(ctx, x + 10, ry - rh / 2, rw, rh, C.ok);
    r[0].forEach((b, j) => T(ctx, String(b), x + 20 + j * cw, ry + .5, { size: 11, bold: true, color: b ? C.one : C.dim, align: 'center' }));
    T(ctx, String(r[1]), xo, ry + .5, { size: 11, bold: true, color: r[1] ? C.one : C.dim, align: 'center' });
    if (tgt) T(ctx, '◂ ALVO', tagX, ry + .5, { size: 11, bold: true, color: C.ok });
    else if (cur) T(ctx, '◂ ATUAL', tagX, ry + .5, { size: 11, bold: true, color: C.amber });
  });
  return 18 + t.rows.length * rh;
}

/* ---------- mapa ---------- */
function chasm(ctx, x, y) {
  rectF(ctx, x, y, 30, 30, C.bg); ctx.save(); ctx.beginPath(); ctx.rect(x, y, 30, 30); ctx.clip(); ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let i = -30; i < 30; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y + 30); ctx.lineTo(x + i + 30, y); ctx.stroke(); } ctx.restore();
}
export function ent(ctx, ox, oy, e) {
  const x = ox + e.c * 30, y = oy + e.r * 30, cx = x + 15, cy = y + 15;
  switch (e.t) {
    case 'sw':
      if (e.v) rectF(ctx, x + 3, y + 3, 24, 24, C.one); else { rectF(ctx, x + 3, y + 3, 24, 24, C.map); rectS(ctx, x + 3, y + 3, 24, 24, C.zero, 2); }
      T(ctx, e.n, cx, y + 10, { size: 11, bold: true, color: e.v ? C.ink : C.text, align: 'center' });
      T(ctx, String(e.v), cx, y + 21, { size: 12, bold: true, color: e.v ? C.ink : C.text, align: 'center' }); break;
    case 'door':
      rectF(ctx, x, y, 30, 30, C.map);
      if (e.open) { rectF(ctx, x + 2, y + 2, 4, 26, C.ok); rectF(ctx, x + 24, y + 2, 4, 26, C.ok); }
      else { rectS(ctx, x + 2, y + 2, 26, 26, C.danger, 2); rectF(ctx, x + 4, y + 13, 22, 4, C.danger); }
      val(ctx, x + 7, y + 7, e.open ? 1 : 0, 16, 11); break;
    case 'laser': {
      const x2 = ox + (e.to ?? e.c) * 30 + 30;
      if (!e.off) { rectF(ctx, cx + 10, cy - 1, x2 - cx - 10, 2, C.danger); for (let xx = x + 30; xx < x2; xx += 30) rectF(ctx, xx, cy - 4, 1, 8, C.danger); }
      else ln(ctx, [[cx + 10, cy], [x2, cy]], C.zero, 1, [2, 4]);
      path(ctx, [[cx, cy - 11], [cx + 11, cy], [cx, cy + 11], [cx - 11, cy]]);
      if (!e.off) { ctx.fillStyle = C.map; ctx.fill(); ctx.strokeStyle = C.danger; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = C.one; ctx.fill(); }
      T(ctx, e.off ? '1' : '0', cx, cy + .5, { size: 11, bold: true, color: e.off ? C.ink : C.text, align: 'center' }); break; }
    case 'bridge': {
      const w = (e.len || 1) * 30;
      if (e.ext) { rectF(ctx, x, y + 5, w, 20, C.map); rectS(ctx, x, y + 5, w, 20, C.ok, 2); for (let xx = x + 6; xx < x + w - 2; xx += 6) rectF(ctx, xx, y + 8, 1, 14, C.ok); }
      else rectS(ctx, x + 1, y + 5, w - 2, 20, C.zero, 1, [3, 3]);
      val(ctx, x + w / 2 - 8, y + 7, e.ext ? 1 : 0, 16, 11); break; }
    case 'plate': rectS(ctx, x + 3, y + 3, 24, 24, C.zero, 1); rectS(ctx, x + 5, y + 5, 20, 20, C.zero, 1); val(ctx, x + 7, y + 7, e.v, 16, 11); break;
    case 'box':
      rectF(ctx, x + 4, y + 4, 22, 22, C.panel); rectS(ctx, x + 4, y + 4, 22, 22, C.text, 2);
      ln(ctx, [[x + 8, y + 8], [x + 22, y + 22]], C.text, 1); ln(ctx, [[x + 22, y + 8], [x + 8, y + 22]], C.text, 1); break;
    case 'term':
      rectF(ctx, x + 4, y + 4, 22, 17, C.panel); rectS(ctx, x + 4, y + 4, 22, 17, C.text, 1.5);
      T(ctx, '>', x + 10, y + 12.5, { size: 11, bold: true }); rectF(ctx, x + 15, y + 15, 6, 2, C.text);
      rectF(ctx, x + 13, y + 21, 4, 3, C.text); rectF(ctx, x + 9, y + 24, 12, 2, C.text); break;
    case 'exit': rectS(ctx, x + 3, y + 3, 24, 24, C.ok, 2, [4, 3]); ln(ctx, [[cx - 6, cy + 3], [cx, cy - 3], [cx + 6, cy + 3]], C.ok, 2); break;
    case 'player': {
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      const d = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[e.d || 'r'];
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx + d[0] * 4.5, cy + d[1] * 4.5, 2.5, 0, Math.PI * 2); ctx.fill();
      if (e.hit) { ctx.strokeStyle = C.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke(); }
      break; }
  }
  if (e.focus) bracket(ctx, x, y, 30, 30);
}
export function level(ctx, L, ox, oy) {
  L.g.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const ch = row[c], x = ox + c * 30, y = oy + r * 30;
    if (ch === '#') rectF(ctx, x, y, 30, 30, C.wall); else if (ch === '.') { rectF(ctx, x, y, 30, 30, C.map); rectS(ctx, x, y, 30, 30, C.grid); } else if (ch === '_') chasm(ctx, x, y); } });
  (L.links || []).forEach(k => ln(ctx, [[ox + k[0][0] * 30 + 15, oy + k[0][1] * 30 + 15], [ox + k[1][0] * 30 + 15, oy + k[1][1] * 30 + 15]], k[2] ? C.one : C.zero, k[2] ? 1.5 : 1, [3, 3], k[2] && FX.on ? -FX.t * 12 : 0));
  (L.e || []).forEach(e => ent(ctx, ox, oy, e));
}

/* ---------- HUD ---------- */
export function hud(ctx, o) {
  rectF(ctx, 0, 0, 680, 28, C.panel); rectF(ctx, 0, 28, 680, 1, C.border);
  let x = 10; x += T(ctx, 'FASE ' + o.phase, x, 14.5, { size: 14, bold: true }) + 10;
  T(ctx, `SETOR ${o.sn} · ${o.sector}`, x, 14.5, { size: 11, color: C.dim });
  const ax = 318, sw = Math.floor((110 - (o.max - 1) * 3) / o.max);
  T(ctx, 'ALERTA', 268, 14.5, { size: 11, bold: true, color: C.dim });
  for (let i = 0; i < o.max; i++) { const sx = ax + i * (sw + 3); if (i < o.alert) rectF(ctx, sx, 9, sw, 11, C.danger); else rectS(ctx, sx, 9, sw, 11, C.border); }
  T(ctx, `${o.alert}/${o.max}`, ax + o.max * (sw + 3) + 6, 14.5, { size: 12, bold: true, color: o.alert >= o.max - 1 ? C.danger : C.text });
  T(ctx, 'POSSÍVEIS', 608, 14.5, { size: 11, bold: true, color: C.dim, align: 'right' });
  for (let i = 0; i < 3; i++) star(ctx, 624 + i * 18, 14, 7.5, i < o.stars);
}
const FOOT = [[['←↑↓→', 'WASD'], 'mover'], ['E', 'interagir'], ['Q', 'scanner'], ['R', 'reiniciar'], ['Esc', 'pausar'], ['Enter', 'confirmar']];

/* ---------- níveis ---------- */
const L11 = (P, Q, open, pl) => ({
  g: ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '######.######', '#...........#', '#...........#', '#############'],
  links: [[[4, 1], [6, 5], P], [[8, 1], [6, 5], Q]],
  e: [{ t: 'sw', c: 4, r: 1, n: 'P', v: P }, { t: 'sw', c: 8, r: 1, n: 'Q', v: Q }, { t: 'door', c: 6, r: 5, open }, { t: 'exit', c: 10, r: 7 }, Object.assign({ t: 'player' }, pl)]
});
const T11 = (P, Q) => ({ op: 'and', v: (1 - P) & Q, a: [{ op: 'not', v: 1 - P, a: [{ in: 'P', v: P }] }, { in: 'Q', v: Q }] });
const L32 = {
  g: ['#############', '#...........#', '#...........#', '#...........#', '#########.###', '#...........#', '#...........#', '#############'],
  links: [[[4, 1], [9, 4], 1], [[7, 1], [9, 4], 1], [[10, 1], [9, 4], 0], [[7, 1], [0, 5], 1], [[10, 1], [0, 5], 0]],
  e: [{ t: 'sw', c: 4, r: 1, n: 'P', v: 1 }, { t: 'sw', c: 7, r: 1, n: 'Q', v: 1 }, { t: 'sw', c: 10, r: 1, n: 'R', v: 0 }, { t: 'door', c: 9, r: 4, open: false },
    { t: 'box', c: 2, r: 6 }, { t: 'plate', c: 5, r: 6, v: 0 }, { t: 'exit', c: 10, r: 6 }, { t: 'laser', c: 0, r: 5, to: 11 }, { t: 'player', c: 9, r: 3, d: 'd' }]
};
const T32 = () => ({ op: 'and', v: 0, a: [{ op: 'imp', v: 1, a: [{ in: 'P', v: 1 }, { in: 'Q', v: 1 }] }, { in: 'R', v: 0 }] });
const TT32 = { vars: ['P', 'Q', 'R'], goal: 1, cur: 6, rows: [[[0, 0, 0], 0], [[0, 0, 1], 1], [[0, 1, 0], 0], [[0, 1, 1], 1], [[1, 0, 0], 0], [[1, 0, 1], 0], [[1, 1, 0], 0], [[1, 1, 1], 1]] };

/* ---------- tela de fase ---------- */
function fase(ctx, o) {
  hud(ctx, o.hud); rectF(ctx, 8, 34, 390, 338, C.bg);
  const oy = 34 + Math.round((338 - o.L.g.length * 30) / 2), lh = o.L.g.length * 30;
  fx('mapVoid', ctx, 8, 34, 390, 338, oy, lh); level(ctx, o.L, 8, oy); fx('mapOver', ctx, 8, 34, 390, 338, oy, lh); rectS(ctx, 8, 34, 390, 338, C.border);
  circuitPanel(ctx, o); footer(ctx, FOOT); return oy;
}
function circuitPanel(ctx, o) {
  panel(ctx, 406, 34, 266, 338, { title: 'MÓDULO · ' + o.el, meta: o.meta || 'ATIVA COM 1' });
  T(ctx, o.f, 418, 66, { size: 18, bold: true }); ln(ctx, [[414, 84], [664, 84]], C.border, 1, [2, 3]);
  o.tree = circuit(ctx, 418, 92, o.tree);
  resultBlock(ctx, 414, 170, 250, o.res);
  const y = 220;
  if (o.lower === 'hint') {
    tab(ctx, 414, y, 'DICA');
    const hh = wrap(ctx, o.hint, 414, y + 30, 246, { size: 12, lh: 16 });
    o.ops.forEach((op, i) => { const yy = y + 38 + hh + i * 26; rectF(ctx, 414, yy - 10, 20, 20, C.map); rectS(ctx, 414, yy - 10, 20, 20, C.border);
      T(ctx, op[0], 424, yy + .5, { size: 14, bold: true, align: 'center' }); T(ctx, op[1], 442, yy + .5, { size: 12 }); });
    keyHint(ctx, 414, 346, 'Q', 'abrir Scanner · tabela-verdade', C.text);
  } else if (o.lower === 'scan') {
    tab(ctx, 414, y, 'SCANNER · TABELA-VERDADE');
    T(ctx, o.scanMeta || (o.tt.rows.filter(r => r[1] === o.tt.goal).length + ' alvos'), 664, y + 8.5, { size: 11, color: o.scanMetaColor || C.dim, align: 'right', bold: !!o.scanMetaColor });
    truth(ctx, 414, y + 28, o.tt);
  } else if (o.lower === 'tut') tutList(ctx, 414, y, o.step);
}
const STEPS = ['Mover o hacker', 'Alternar um interruptor', 'Ler os valores 0 e 1', 'Observar o circuito', 'Abrir o Scanner', 'Chegar à saída'];
function tutList(ctx, x, y, step) {
  tab(ctx, x, y, 'TREINAMENTO', 'focus'); T(ctx, `PASSO ${step}/6`, 664, y + 8.5, { size: 11, bold: true, color: C.amber, align: 'right' });
  STEPS.forEach((s, i) => { const yy = y + 32 + i * 20, n = i + 1, done = n < step, cur = n === step;
    T(ctx, done ? '✓' : cur ? '▸' : '·', x + 4, yy, { size: 12, bold: true, color: done ? C.ok : cur ? C.amber : C.dim });
    T(ctx, `${n}  ${s}`, x + 20, yy, { size: 12, bold: cur, color: cur ? C.text : C.dim }); });
}
function callout(ctx, x, y, w, o) {
  const ls = wrapLines(ctx, o.text, w - 20, 12), h = 32 + ls.length * 16 + (o.keys ? 22 : 0);
  if (o.to) { ln(ctx, [o.from, o.to], C.amber, 1.5); rectF(ctx, o.to[0] - 2.5, o.to[1] - 2.5, 5, 5, C.amber); }
  chamfer(ctx, x, y, w, h, 6, C.panel, C.amber, 1); tab(ctx, x, y, o.step, 'focus');
  ls.forEach((l, i) => T(ctx, l, x + 10, y + 30 + i * 16, { size: 12 }));
  if (o.keys) keyHint(ctx, x + 10, y + h - 24, o.keys[0], o.keys[1], C.text);
}

/* ---------- telas ---------- */
const S = {};
S['fase-dica'] = ctx => fase(ctx, { hud: { phase: '3-2', sn: 3, sector: 'PROTOCOLOS', alert: 4, max: 6, stars: 2 }, L: L32,
  el: 'PORTA D1', f: '(P → Q) ∧ R', tree: T32(), res: { v: 0, goal: 1, state: 'PORTA TRANCADA', need: 'AND: 1 de 2 entradas em 1' },
  lower: 'hint', hint: 'A porta abre quando o circuito inteiro dá 1.', ops: [['→', 'só dá 0 quando 1 → 0'], ['∧', 'só dá 1 com as duas em 1']] });
S['fase-scan'] = ctx => fase(ctx, { hud: { phase: '3-2', sn: 3, sector: 'PROTOCOLOS', alert: 4, max: 6, stars: 2 }, L: L32,
  el: 'PORTA D1', f: '(P → Q) ∧ R', tree: T32(), res: { v: 0, goal: 1, state: 'PORTA TRANCADA', need: 'AND: 1 de 2 entradas em 1' }, lower: 'scan', tt: TT32 });

S['menu'] = ctx => {
  TY(ctx, ['// LAB-07 · SISTEMA DE SEGURANÇA', '// conectando ao LAB-07 ...', '// 2 de 10 fases comprometidas', '// setor 2 · REDE aguardando invasão'], 16, 22, { size: 11, color: C.dim });
  TX(ctx, 'CIRCUIT', 16, 54, { size: 30, bold: true }, 0.1); const bw = TX(ctx, 'BREACH', 16, 86, { size: 30, bold: true }, 0.3);
  rectF(ctx, 16 + bw + 6, 74, 12, 24, C.amber);
  T(ctx, 'O Hacker Lógico', 16, 114, { size: 14 });
  panel(ctx, 16, 134, 220, 70, { title: 'PROGRESSO', meta: '2/10 FASES' });
  star(ctx, 30, 168, 9, true); T(ctx, '5', 46, 168, { size: 22, bold: true }); T(ctx, '/ 30 estrelas', 64, 169, { size: 12, color: C.dim });
  for (let i = 0; i < 10; i++) { const sx = 24 + i * 21; if (i < 2) rectF(ctx, sx, 186, 19, 8, C.ok); else rectS(ctx, sx, 186, 19, 8, C.border); }
  panel(ctx, 16, 214, 220, 152, { v: 'focus', title: 'ALVO SELECIONADO' });
  T(ctx, '2-1', 28, 248, { size: 24, bold: true, color: C.amber }); T(ctx, 'Ponte de dados', 28, 274, { size: 14, bold: true });
  T(ctx, 'SETOR 2 · REDE', 28, 292, { size: 11, color: C.dim });
  T(ctx, 'NOVO OPERADOR', 28, 312, { size: 11, color: C.dim }); T(ctx, '∨ OR', 128, 312, { size: 12, bold: true });
  button(ctx, 28, 328, 196, 26, 'INVADIR', 'confirm', { key: 'Enter' });
  const sectors = [['ACESSO', [['1-1', 'Porta de entrada', 'done', 3], ['1-2', 'Corredor laser', 'done', 2]], 'done'],
    ['REDE', [['2-1', 'Ponte de dados', 'sel', 0], ['2-2', 'Roteador', 'lock']], 'cur'],
    ['PROTOCOLOS', [['3-1', 'Handshake', 'lock'], ['3-2', 'Protocolo duplo', 'lock']], 'lock'],
    ['FIREWALL', [['4-1', 'Montagem', 'lock'], ['4-2', 'Espelhado', 'lock']], 'lock'],
    ['NÚCLEO', [['5-1', 'Terminais', 'lock'], ['5-2', 'Núcleo central', 'lock']], 'lock']];
  rectF(ctx, 266, 45, 1, 288, C.border); fx('menuBus', ctx);
  sectors.forEach(([name, ph, st], i) => {
    const y0 = 14 + i * 72, ny = y0 + 24;
    if (st === 'lock') { rectF(ctx, 261, ny, 11, 11, C.bg); rectS(ctx, 261, ny, 11, 11, C.border); } else rectF(ctx, 261, ny, 11, 11, st === 'done' ? C.ok : C.amber);
    if (FX.on) rectF(ctx, 276, y0 + 10, 80, 38, C.bg);
    T(ctx, 'SETOR ' + (i + 1), 280, y0 + 20, { size: 11, color: C.dim }); T(ctx, name, 280, y0 + 38, { size: 12, bold: true, color: st === 'lock' ? C.dim : C.text });
    ph.forEach(([id, nm, s, stars], j) => {
      const x = 360 + j * 156, w = 148, h = 58;
      if (s === 'lock') { chamfer(ctx, x, y0, w, h, 6, C.bg, C.border, 1, [3, 3]); lock(ctx, x + w - 16, y0 + 17, C.dim); }
      else chamfer(ctx, x, y0, w, h, 6, C.panel, s === 'sel' ? C.amber : C.border, s === 'sel' ? 2 : 1);
      T(ctx, (s === 'sel' ? '▸ ' : '') + id, x + 10, y0 + 17, { size: 14, bold: true, color: s === 'sel' ? C.amber : s === 'lock' ? C.dim : C.text });
      T(ctx, nm, x + 10, y0 + 39, { size: 12, color: s === 'lock' ? C.dim : C.text });
      if (s !== 'lock') for (let k = 0; k < 3; k++) star(ctx, x + w - 46 + k * 16, y0 + 17, 6, k < (stars || 0));
    });
  });
  footer(ctx, [[['←↑↓→', 'WASD'], 'escolher fase'], ['Enter', 'invadir'], ['Esc', 'sair']]);
};

S['firewall'] = ctx => {
  hud(ctx, { phase: '4-1', sn: 4, sector: 'FIREWALL', alert: 1, max: 4, stars: 2 });
  panel(ctx, 8, 34, 428, 338, { title: 'FIREWALL · MONTAGEM DE CIRCUITO', meta: 'TESTE 1 ✕', metaColor: C.danger, metaBold: true });
  T(ctx, 'ALVO', 20, 64, { size: 11, bold: true, color: C.ok }); T(ctx, '1 só quando A e B são diferentes', 56, 64, { size: 12 });
  T(ctx, 'vale qualquer circuito equivalente', 56, 80, { size: 11, color: C.dim });
  const toks = ['(A', { n: 1, op: 'or' }, 'B)', { n: 2, op: 'and' }, '¬(A', { n: 3, op: 'xor', sel: true }, 'B)'];
  let tw = 0; toks.forEach(t => { tw += typeof t === 'string' ? W(ctx, t, 18, true) : 60; }); tw += 8 * (toks.length - 1);
  let x = Math.round(8 + (428 - tw) / 2); const sy = 122;
  toks.forEach(t => {
    if (typeof t === 'string') { x += T(ctx, t, x, sy, { size: 18, bold: true }) + 8; return; }
    T(ctx, 'ESP ' + t.n, x + 30, sy - 24, { size: 11, bold: !!t.sel, color: t.sel ? C.amber : C.dim, align: 'center' });
    rectF(ctx, x, sy - 14, 60, 28, C.map); rectS(ctx, x, sy - 14, 60, 28, t.sel ? C.amber : C.text, t.sel ? 2 : 1);
    T(ctx, OPS[t.op][0] + ' ' + OPS[t.op][1], x + 30, sy + .5, { size: 12, bold: true, color: t.sel ? C.amber : C.text, align: 'center' }); x += 68;
  });
  ln(ctx, [[16, 146], [428, 146]], C.border, 1, [2, 3]);
  T(ctx, 'CIRCUITO NA LINHA  A=0  B=1', 20, 160, { size: 11, color: C.dim });
  const A = { in: 'A', v: 0 }, B = { in: 'B', v: 1 };
  const tr = circuit(ctx, 24, 172, { op: 'and', v: 0, a: [{ op: 'or', v: 1, a: [A, B] }, { op: 'not', v: 0, a: [{ op: 'xor', v: 1, sel: true, a: [{ in: 'A', v: 0 }, { in: 'B', v: 1 }] }] }] });
  T(ctx, '≠', tr.x2 + 6, tr.cy + .5, { size: 14, bold: true, color: C.danger, align: 'center' });
  T(ctx, 'ALVO', tr.x2 + 32, tr.cy - 17, { size: 11, bold: true, color: C.ok, align: 'center' }); val(ctx, tr.x2 + 22, tr.cy - 8, 1, 20, 13);
  T(ctx, 'PORTA PARA O ESPAÇO 3', 20, 278, { size: 11, color: C.dim });
  [['AND ∧', '1'], ['OR ∨', '2'], ['XOR ⊕', '3']].forEach((b, i) => button(ctx, 20 + i * 132, 288, 124, 28, b[0], i === 2 ? 'selected' : 'default', { key: b[1] }));
  button(ctx, 20, 328, 200, 30, 'TESTAR CIRCUITO', 'confirm', { key: 'Enter' });
  T(ctx, 'último teste: 1 de 4 linhas', 232, 343.5, { size: 11, color: C.dim });
  panel(ctx, 444, 34, 228, 338, { title: 'TABELA-VERDADE', meta: '1/4 OK', metaColor: C.danger, metaBold: true });
  const cols = [468, 498, 548, 598, 646]; ['A', 'B', 'ALVO', 'SEU', ''].forEach((h, i) => T(ctx, h, cols[i], 66, { size: 11, bold: true, color: i === 2 ? C.ok : C.dim, align: 'center' }));
  rectF(ctx, 454, 76, 210, 1, C.border);
  const rows = [[0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]];
  rows.forEach((r, i) => { const ry = 98 + i * 32, ok = r[2] === r[3];
    if (i === 1) { rectF(ctx, 454, ry - 13, 210, 26, C.grid); T(ctx, '▸', 447, ry, { size: 12, bold: true, color: C.amber }); }
    rectS(ctx, 454, ry - 13, 210, 26, ok ? C.ok : C.danger);
    r.forEach((b, j) => T(ctx, String(b), cols[j], ry + .5, { size: 16, bold: true, color: b ? C.one : C.dim, align: 'center' }));
    T(ctx, ok ? '✓' : '✕', cols[4], ry + .5, { size: 14, bold: true, color: ok ? C.ok : C.danger, align: 'center' }); });
  rows.forEach((r, i) => rectF(ctx, 456 + i * 52, 236, 48, 8, r[2] === r[3] ? C.ok : C.danger));
  T(ctx, '1 de 4 linhas batem com o alvo', 456, 258, { size: 11 });
  tab(ctx, 452, 278, 'DIAGNÓSTICO');
  wrap(ctx, 'As linhas 01, 10 e 11 divergem. Revise o espaço 3 e teste de novo.', 456, 310, 206, { size: 12, lh: 16 });
  footer(ctx, [[['←', '→'], 'espaço'], [['↑', '↓'], 'porta'], ['Enter', 'testar'], ['Esc', 'voltar ao mapa']]);
};

S['espelhado'] = ctx => {
  hud(ctx, { phase: '4-2', sn: 4, sector: 'FIREWALL', alert: 0, max: 3, stars: 3 });
  panel(ctx, 8, 40, 170, 82, { title: 'BANCADA' }); input(ctx, 22, 66, 'P', 1); input(ctx, 72, 66, 'Q', 1);
  key(ctx, 22, 96, '1'); key(ctx, 41, 96, '2'); T(ctx, 'alternam', 62, 104.5, { size: 11, color: C.dim });
  panel(ctx, 196, 40, 288, 82, { title: 'PAINEL ORIGINAL' });
  T(ctx, '¬(P ∧ Q)', 330, 78, { size: 22, bold: true, align: 'center' }); T(ctx, '=', 410, 78, { size: 14, bold: true, color: C.dim }); val(ctx, 424, 67, 0, 22, 14);
  T(ctx, 'equivalente = mesma tabela-verdade', 340, 106, { size: 11, color: C.dim, align: 'center' });
  panel(ctx, 502, 40, 170, 82, { title: 'RODADA 1 DE 4' });
  for (let i = 0; i < 4; i++) { const px = 516 + i * 34; if (i === 0) { rectS(ctx, px, 62, 26, 26, C.amber, 2); T(ctx, '1', px + 13, 75.5, { size: 13, bold: true, color: C.amber, align: 'center' }); } else { rectS(ctx, px, 62, 26, 26, C.border); T(ctx, String(i + 1), px + 13, 75.5, { size: 13, bold: true, color: C.dim, align: 'center' }); } }
  T(ctx, 'cabo errado: +1 alerta', 516, 104, { size: 11, color: C.dim });
  ln(ctx, [[340, 122], [340, 134], [172, 134], [172, 146]], C.amber, 2);
  ln(ctx, [[340, 134], [508, 134], [508, 146]], C.border, 2, [5, 4]);
  const cand = (x, n, f, op, sel, dash) => {
    panel(ctx, x, 146, 328, 222, { v: sel ? 'focus' : 'default', title: 'CABO ' + n, meta: dash ? 'tracejado' : 'contínuo' });
    ln(ctx, [[x + 250 - (dash ? 8 : 0), 155], [x + 250 - 40 - (dash ? 8 : 0), 155]], sel ? C.amber : C.text, 2, dash ? [5, 4] : null);
    T(ctx, f, x + 164, 186, { size: 18, bold: true, align: 'center' });
    circuit(ctx, x + 38, 208, { op, v: 0, a: [{ op: 'not', v: 0, a: [{ in: 'P', v: 1 }] }, { op: 'not', v: 0, a: [{ in: 'Q', v: 1 }] }] });
    ln(ctx, [[x + 14, 262], [x + 314, 262]], C.border, 1, [2, 3]);
    T(ctx, 'NA BANCADA', x + 14, 280, { size: 11, color: C.dim }); val(ctx, x + 96, 271, 0, 18, 12);
    T(ctx, '= painel nesta linha', x + 122, 280.5, { size: 11 });
    button(ctx, x + 14, 320, 300, 30, 'LIGAR CABO ' + n, sel ? 'selected' : 'default', { key: 'Enter' });
  };
  cand(8, 1, '¬P ∧ ¬Q', 'and', true, false); cand(344, 2, '¬P ∨ ¬Q', 'or', false, true);
  footer(ctx, [[['←', '→'], 'cabo'], [['1', '2'], 'bancada'], ['Enter', 'ligar'], ['Esc', 'voltar ao mapa']]);
};

S['terminais'] = ctx => {
  hud(ctx, { phase: '5-1', sn: 5, sector: 'NÚCLEO', alert: 0, max: 3, stars: 3 });
  T(ctx, 'REGRA', 12, 46, { size: 11, bold: true, color: C.dim });
  T(ctx, 'Confiável sempre diz a verdade; comprometido sempre mente. Se A diz φ, vale A ↔ φ.', 56, 46, { size: 11 });
  const card = (x, id, sel, quote, f, leg, mark) => {
    panel(ctx, x, 60, 328, 262, { v: sel ? 'focus' : 'default', title: 'TERMINAL ' + id, meta: mark == null ? 'NÃO MARCADO' : 'MARCADO', metaColor: mark == null ? C.dim : C.text, metaBold: mark != null });
    T(ctx, 'FALA', x + 14, 96, { size: 11, bold: true, color: C.dim });
    wrap(ctx, quote, x + 14, 118, 300, { size: 14, bold: true, lh: 18 });
    ln(ctx, [[x + 14, 146], [x + 314, 146]], C.border, 1, [2, 3]);
    T(ctx, 'TRADUÇÃO LÓGICA', x + 14, 164, { size: 11, bold: true, color: C.dim });
    T(ctx, f, x + 14, 190, { size: 22, bold: true });
    wrap(ctx, leg, x + 14, 218, 300, { size: 11, color: C.dim, lh: 14 });
    [['CONFIÁVEL', 1, '↑'], ['COMPROMETIDO', 0, '↓']].forEach(([lab, v, k], i) => {
      const bx = x + 14 + i * 154, on = mark === v;
      chamfer(ctx, bx, 278, 146, 30, 5, C.map, on ? C.amber : C.border, on ? 2 : 1); val(ctx, bx + 8, 285, v, 16, 11);
      T(ctx, lab, bx + 30, 293.5, { size: 11, bold: true, color: on ? C.amber : C.text }); key(ctx, bx + 146 - 24, 285, k);
    });
  };
  card(8, 'A', true, '“O terminal B está comprometido.”', 'A ↔ ¬B', 'A: o terminal A é confiável · ¬B: o terminal B é comprometido', 1);
  card(344, 'B', false, '“Nós dois somos do mesmo tipo.”', 'B ↔ (A ↔ B)', 'B: o terminal B é confiável · A ↔ B: os dois são do mesmo tipo', null);
  button(ctx, 210, 334, 260, 30, 'CONFERIR MARCAÇÃO', 'disabled', { key: 'Enter' });
  T(ctx, '1 de 2 marcados', 482, 349.5, { size: 11, color: C.dim });
  footer(ctx, [[['←', '→'], 'terminal'], ['↑', 'confiável'], ['↓', 'comprometido'], ['Enter', 'conferir'], ['Esc', 'mapa']]);
};

S['nucleo'] = ctx => {
  hud(ctx, { phase: '5-2', sn: 5, sector: 'NÚCLEO', alert: 1, max: 4, stars: 2 });
  panel(ctx, 8, 34, 440, 338, { title: 'NÚCLEO CENTRAL · PROVA 1 DE 3', meta: 'passo inválido: +1 alerta' });
  const lines = [
    { n: 1, f: 'P → Q', tag: 'PREMISSA', log: 'Se o backup do servidor está ativo, então o firewall reinicia automaticamente.' },
    { n: 2, f: 'Q → R', tag: 'PREMISSA', log: 'Se o firewall reinicia, então o alarme central dispara.' },
    { n: 3, f: '¬R', tag: 'PREMISSA', log: 'O alarme central não disparou nesta noite.', mark: true },
    { sep: 'DERIVADAS' },
    { n: 4, f: 'P → R', tag: 'SH · 1, 2', log: 'Silogismo hipotético aplicado às linhas 1 e 2.', mark: true, cur: true, der: true }];
  let y = 58;
  lines.forEach(l => {
    if (l.sep) { T(ctx, l.sep, 20, y + 6, { size: 11, bold: true, color: C.dim }); ln(ctx, [[92, y + 6], [436, y + 6]], C.border, 1, [2, 3]); y += 16; return; }
    const ls = wrapLines(ctx, 'log: ' + l.log, 356, 11), h = 26 + ls.length * 14;
    if (l.cur) { rectF(ctx, 14, y, 428, h, C.map); rectF(ctx, 14, y, 2, h, C.amber); }
    if (l.mark) { rectF(ctx, 22, y + 6, 14, 14, C.amber); T(ctx, '✓', 29, y + 13.5, { size: 11, bold: true, color: C.ink, align: 'center' }); } else rectS(ctx, 22, y + 6, 14, 14, C.dim);
    T(ctx, l.n + '.', 44, y + 13.5, { size: 12, color: C.dim }); T(ctx, l.f, 66, y + 13.5, { size: 14, bold: true });
    if (l.der) { const tw = W(ctx, l.tag, 11, true) + 12; rectS(ctx, 436 - tw, y + 5, tw, 16, C.text); T(ctx, l.tag, 436 - tw / 2, y + 13.5, { size: 11, bold: true, align: 'center' }); }
    else T(ctx, l.tag, 436, y + 13.5, { size: 11, color: C.dim, align: 'right' });
    ls.forEach((s, i) => T(ctx, s, 66, y + 30 + i * 14, { size: 11, color: C.dim }));
    y += h + 4;
  });
  rectS(ctx, 14, y + 2, 428, 26, C.border, 1, [3, 3]); T(ctx, '5.', 44, y + 15.5, { size: 12, color: C.dim });
  T(ctx, 'marque linhas e aplique uma regra', 66, y + 15.5, { size: 11, color: C.dim });
  panel(ctx, 456, 34, 216, 58, { v: 'ok', title: 'META' });
  T(ctx, '¬P', 564, 64, { size: 22, bold: true, color: C.ok, align: 'center' });
  T(ctx, 'derive para abrir o núcleo', 564, 82, { size: 11, color: C.dim, align: 'center' });
  T(ctx, 'REGRAS DE INFERÊNCIA', 458, 106, { size: 11, bold: true, color: C.dim });
  ['MP', 'MT', 'SH', 'SD', 'SIMP esq.', 'SIMP dir.', 'CONJ', 'AD'].forEach((r, i) => button(ctx, 456 + (i % 2) * 112, 116 + Math.floor(i / 2) * 28, 104, 24, r, i === 1 ? 'selected' : 'default'));
  panel(ctx, 456, 234, 216, 138, { title: 'MODUS TOLLENS' });
  T(ctx, 'A → B', 470, 266, { size: 14, bold: true }); T(ctx, '¬B', 470, 286, { size: 14, bold: true });
  rectF(ctx, 470, 298, 60, 1, C.text); T(ctx, '⊢ ¬A', 470, 312, { size: 14, bold: true });
  T(ctx, 'REQUER', 570, 262, { size: 11, color: C.dim }); T(ctx, '2 linhas', 570, 278, { size: 12 });
  T(ctx, 'MARCADAS', 570, 298, { size: 11, color: C.dim }); T(ctx, '3, 4', 570, 314, { size: 12, bold: true, color: C.amber });
  button(ctx, 466, 334, 196, 28, 'APLICAR MT', 'confirm', { key: 'Enter' });
  footer(ctx, [[['↑', '↓'], 'linha'], ['E', 'marcar'], [['←', '→'], 'regra'], ['Enter', 'aplicar'], ['Esc', 'mapa']]);
};

S['vitoria'] = ctx => {
  fase(ctx, { hud: { phase: '1-1', sn: 1, sector: 'ACESSO', alert: 2, max: 5, stars: 3 }, L: L11(0, 1, true, { c: 10, r: 7, d: 'r' }),
    el: 'PORTA D1', f: '¬P ∧ Q', tree: T11(0, 1), res: { v: 1, goal: 1, state: 'PORTA ABERTA', need: 'meta atingida · vá à saída' },
    lower: 'hint', hint: 'A porta abre quando o circuito inteiro dá 1.', ops: [['¬', 'inverte a entrada'], ['∧', 'só dá 1 com as duas em 1']] });
  rectF(ctx, 9, 35, 388, 336, 'rgba(10,17,26,0.8)');
  panel(ctx, 34, 98, 338, 212, { v: 'ok', title: 'FASE 1-1 CONCLUÍDA', meta: 'SETOR 1 · ACESSO' });
  TX(ctx, 'ACESSO LIBERADO', 203, 132, { size: 18, bold: true, color: C.ok, align: 'center' }, 0.15);
  for (let i = 0; i < 3; i++) star(ctx, 171 + i * 32, 162, 13, !FX.on || FX.t - FX.t0 > 0.7 + i * 0.15);
  T(ctx, '3 de 3 estrelas', 203, 186, { size: 11, color: C.dim, align: 'center' });
  ln(ctx, [[48, 198], [358, 198]], C.border, 1, [2, 3]);
  [['TROCAS', '2'], ['MÍNIMO', '2'], ['ALERTA', '2/5']].forEach(([l, v], i) => { const cx = 103 + i * 100; T(ctx, l, cx, 212, { size: 11, color: C.dim, align: 'center' }); T(ctx, v, cx, 230, { size: 16, bold: true, align: 'center' }); });
  T(ctx, '✓ SOLUÇÃO ÓTIMA · trocas = mínimo', 203, 252, { size: 11, bold: true, color: C.ok, align: 'center' });
  button(ctx, 48, 270, 178, 28, 'PRÓXIMA FASE', 'confirm', { key: 'Enter' }); button(ctx, 234, 270, 124, 28, 'REPETIR', 'default', { key: 'R' });
};

S['final'] = ctx => {
  const P = (str, x, y, o = {}, d) => { if (FX.on) { const sz = o.size || 12, w = W(ctx, str, sz, o.bold), x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x; rectF(ctx, x0 - 4, y - sz * 0.75, w + 8, sz * 1.5, C.bg); }
    return d === undefined ? T(ctx, str, x, y, o) : TX(ctx, str, x, y, o, d); };
  if (FX.on) rectF(ctx, 20, 16, W(ctx, '> breach --status', 11) + 16, 20, C.bg);
  TY(ctx, ['> breach --status'], 24, 26, { size: 11, color: C.dim }, Infinity, 24); tab(ctx, 24, 38, 'SISTEMA COMPROMETIDO', 'ok');
  P('CIRCUIT', 24, 86, { size: 34, bold: true }, 0.4); P('BREACH', 24, 122, { size: 34, bold: true }, 0.55);
  P('Invasão concluída.', 24, 154, { size: 14, bold: true });
  wrapLines(ctx, 'Você atravessou os 5 setores usando só lógica proposicional.', 296, 12).forEach((l, i) => P(l, 24, 176 + i * 16));
  const got = FX.on ? Math.max(0, Math.min(26, Math.floor((FX.t - FX.t0 - 0.9) / 0.035))) : 26;
  if (FX.on) rectF(ctx, 18, 208, 310, 68, C.bg);
  star(ctx, 36, 226, 12, true); T(ctx, String(got), 56, 226, { size: 30, bold: true }); T(ctx, '/ 30 estrelas', 102, 229, { size: 12, color: C.dim });
  T(ctx, Math.round(got / 30 * 100) + '%', 320, 226, { size: 18, bold: true, align: 'right' });
  for (let i = 0; i < 30; i++) { const sx = 24 + i * 10; if (i < got) rectF(ctx, sx, 246, 8, 10, C.amber); else rectS(ctx, sx, 246, 8, 10, C.border); }
  T(ctx, 'concluído', 320, 268, { size: 11, color: C.dim, align: 'right' });
  panel(ctx, 24, 284, 300, 86, { title: 'EQUIPE', meta: 'Lógica da Computação' });
  const team = ['Arllesson Gomes', 'Luan Martins', 'João Miguel Freitas'];
  if (FX.on) { // créditos sobem dentro do painel, em loop
    const roll = [['CRÉDITOS', 1], ...team.map(n => [n, 0]), ['', 0], ['DISCIPLINA', 1], ['Lógica da Computação', 0], ['', 0], ['OBRIGADO POR JOGAR', 1], ['', 0]];
    const H = roll.length * 17, off = (Math.max(0, FX.t - FX.t0) * 12) % H;
    ctx.save(); ctx.beginPath(); ctx.rect(26, 302, 296, 66); ctx.clip();
    for (let k = 0; k < 2; k++) roll.forEach(([str, h], i) => { const yy = 312 + i * 17 - off + k * H; if (str && yy > 290 && yy < 380) T(ctx, str, 38, yy, { size: h ? 11 : 12, bold: true, color: h ? C.dim : C.text }); });
    ctx.restore();
  } else team.forEach((n, i) => T(ctx, n, 38, 312 + i * 17, { size: 12, bold: true }));
  panel(ctx, 348, 20, 316, 290, { title: 'RELATÓRIO DA INVASÃO', meta: '10/10 FASES' });
  const sec = [['ACESSO', [3, 3]], ['REDE', [3, 2]], ['PROTOCOLOS', [3, 3]], ['FIREWALL', [2, 3]], ['NÚCLEO', [2, 2]]];
  sec.forEach(([n, st], i) => { const y = 54 + i * 32;
    T(ctx, '✓', 362, y, { size: 12, bold: true, color: C.ok }); T(ctx, 'S' + (i + 1), 378, y, { size: 11, color: C.dim }); T(ctx, n, 400, y, { size: 12, bold: true });
    st.forEach((s, j) => { for (let k = 0; k < 3; k++) star(ctx, 504 + j * 56 + k * 14, y, 5.5, k < s); });
    T(ctx, `${st[0] + st[1]}/6`, 652, y, { size: 12, bold: true, align: 'right' });
    if (i < 4) rectF(ctx, 362, y + 16, 290, 1, C.grid); });
  ln(ctx, [[362, 218], [652, 218]], C.border, 1, [2, 3]);
  [['TROCAS', '48', 'mín. 41'], ['ALERTAS', '9', 'em 10 fases'], ['PROVAS', '3/3', 'núcleo']].forEach(([l, v, s], i) => { const x = 362 + i * 100;
    T(ctx, l, x, 236, { size: 11, color: C.dim }); T(ctx, v, x, 258, { size: 18, bold: true }); T(ctx, s, x, 280, { size: 11, color: C.dim }); });
  P('Obrigado por jogar.', 348, 330, { size: 12 });
  button(ctx, 348, 342, 316, 28, 'VOLTAR AO MENU', 'confirm', { key: 'Enter' });
  footer(ctx, [['Enter', 'menu'], ['R', 'rever créditos']]);
};

const tutBase = (ctx, P, Q, pl, step, lower, tt) => fase(ctx, { hud: { phase: '1-1', sn: 1, sector: 'ACESSO', alert: 0, max: 5, stars: 3 }, L: L11(P, Q, false, pl),
  el: 'PORTA D1', f: '¬P ∧ Q', tree: T11(P, Q), res: { v: (1 - P) & Q, goal: 1, state: 'PORTA TRANCADA', need: `AND: ${(1 - P) + Q} de 2 entradas em 1` },
  lower, step, tt, scanMeta: 'PASSO 5/6', scanMetaColor: C.amber });
S['tut1'] = ctx => {
  const oy = tutBase(ctx, 1, 0, { c: 2, r: 3, d: 'r' }, 1, 'tut');
  ln(ctx, [[83, oy + 105], [83, oy + 75], [128, oy + 75]], C.amber, 1.5, [3, 3]);
  bracket(ctx, 128, oy + 30, 30, 30);
  callout(ctx, 150, oy + 112, 220, { step: 'PASSO 1/6', text: 'Ande até o interruptor P. Depois aperte E para alternar o valor.', keys: [['←↑↓→', 'WASD'], ''], from: [150, oy + 130], to: [96, oy + 112] });
};
S['tut2'] = ctx => {
  const oy = tutBase(ctx, 0, 0, { c: 4, r: 2, d: 'u' }, 3, 'tut');
  bracket(ctx, 248, oy + 30, 30, 30); bracket(ctx, 416, 114, 44, 24);
  callout(ctx, 118, oy + 98, 236, { step: 'PASSO 3/6', text: 'Q = 0: contorno e fundo escuro. Valor 1 é sempre preenchido. O mesmo valor chega ao circuito.', from: [354, oy + 120], to: [414, 126] });
};
S['tut3'] = ctx => {
  const oy = tutBase(ctx, 0, 0, { c: 4, r: 2, d: 'u' }, 5, 'scan', { vars: ['P', 'Q'], goal: 1, cur: 0, rows: [[[0, 0], 0], [[0, 1], 1], [[1, 0], 0], [[1, 1], 0]] });
  callout(ctx, 112, oy + 98, 250, { step: 'PASSO 5/6', text: 'O Scanner mostra todas as combinações. A linha ◂ ALVO abre a porta: deixe P em 0 e ligue Q.', keys: ['Q', 'abrir / fechar'], from: [362, oy + 130], to: [414, 270] });
};

/* ---------- feedback de eventos (200×124) ---------- */
const mini = (ctx, g, e, links) => { level(ctx, { g, e, links }, 10, 4); };
S['fb-porta'] = ctx => { mini(ctx, ['......', '##.###', '......'], [{ t: 'door', c: 2, r: 1, open: true }, { t: 'player', c: 2, r: 2, d: 'u' }]); toast(ctx, 10, 98, 180, 'ok', '✓', 'PORTA ABERTA · saída 1'); };
S['fb-laser'] = ctx => { mini(ctx, ['......', '......', '......'], [{ t: 'laser', c: 0, r: 1, to: 5, off: true }, { t: 'player', c: 3, r: 2, d: 'u' }]); toast(ctx, 10, 98, 180, 'ok', '✓', 'LASER DESATIVADO'); };
S['fb-ponte'] = ctx => { mini(ctx, ['..__..', '..__..', '..__..'], [{ t: 'bridge', c: 2, r: 1, len: 2, ext: true }, { t: 'player', c: 1, r: 1, d: 'r' }]); toast(ctx, 10, 98, 180, 'ok', '✓', 'PONTE ESTENDIDA'); };
S['fb-alarme'] = ctx => {
  mini(ctx, ['......', '......', '......'], [{ t: 'sw', c: 2, r: 1, n: 'R', v: 1 }, { t: 'player', c: 2, r: 2, d: 'u' }]);
  rectS(ctx, 10, 4, 180, 90, C.danger, 2); rectF(ctx, 12, 6, 176, 18, C.panel);
  T(ctx, 'ALERTA', 18, 15.5, { size: 11, bold: true, color: C.dim });
  for (let i = 0; i < 5; i++) { const sx = 70 + i * 17; if (i < 3) rectF(ctx, sx, 10, 14, 10, C.danger); else rectS(ctx, sx, 10, 14, 10, C.border); }
  T(ctx, '+1', 160, 15.5, { size: 11, bold: true, color: C.danger });
  toast(ctx, 10, 98, 180, 'danger', '!', 'ALARME +1 · 3/5');
};
S['fb-atingido'] = ctx => { mini(ctx, ['......', '......', '......'], [{ t: 'laser', c: 0, r: 1, to: 5 }, { t: 'player', c: 3, r: 1, d: 'r', hit: true }]); toast(ctx, 10, 98, 180, 'danger', '✕', 'ATINGIDO · R reinicia'); };
S['fb-certo'] = ctx => { circuit(ctx, 10, 8, T11(0, 1), { gw: 60 }); resultBlock(ctx, 10, 66, 180, { v: 1, goal: 1, state: 'PORTA ABERTA', need: 'saída 1 = meta 1', noMeta: true }); };
S['fb-errado'] = ctx => { circuit(ctx, 10, 8, T11(1, 0), { gw: 60 }); resultBlock(ctx, 10, 66, 180, { v: 0, goal: 1, state: 'PORTA TRANCADA', need: 'saída 0 ≠ meta 1', noMeta: true }); };

/* ---------- biblioteca de componentes ---------- */
S['c-paineis'] = ctx => {
  [['default', 'PADRÃO'], ['focus', 'DESTACADO'], ['danger', 'PERIGO'], ['ok', 'SUCESSO']].forEach(([v, t], i) => {
    const x = 10 + i * 167; panel(ctx, x, 10, 158, 110, { v, title: t, meta: 'meta' });
    T(ctx, 'conteúdo 12 px', x + 12, 44, { size: 12 }); T(ctx, 'secundário 11 px', x + 12, 62, { size: 11, color: C.dim });
    ln(ctx, [[x + 10, 90], [x + 148, 90]], C.border, 1, [2, 3]); keyHint(ctx, x + 12, 96, 'E', 'rodapé');
  });
};
S['c-botoes'] = ctx => {
  [['PADRÃO', 'default'], ['SELECIONADO', 'selected'], ['DESABILITADO', 'disabled'], ['TESTAR', 'confirm', 'Enter'], ['ABORTAR', 'danger']].forEach(([l, s, k], i) =>
    button(ctx, 10 + i * 133, 10, 126, 28, l, s, k ? { key: k } : {}));
};
S['c-logica'] = ctx => {
  val(ctx, 10, 12, 0, 16); val(ctx, 32, 12, 1, 16); val(ctx, 56, 10, 0, 20); val(ctx, 82, 10, 1, 20); val(ctx, 110, 7, 0, 26, 18); val(ctx, 142, 7, 1, 26, 18); val(ctx, 174, 10, '?', 20);
  input(ctx, 206, 10, 'P', 0); input(ctx, 254, 10, 'P', 1);
  ln(ctx, [[306, 16], [346, 16], [346, 24], [370, 24]], C.one, 2); ln(ctx, [[306, 34], [346, 34], [346, 28], [370, 28]], C.zero, 1);
  resultBlock(ctx, 420, 0, 250, { v: 0, goal: 1, state: 'PORTA TRANCADA', need: 'AND: 1 de 2 entradas em 1' });
  [['not', 1], ['and', 0], ['or', 1], ['xor', 0], ['imp', 1], ['bic', 0]].forEach(([op, v], i) => gate(ctx, 10 + i * 96, 68, op, v));
  gate(ctx, 584, 68, 'and', 1, { root: true, w: 92 });
  T(ctx, '(P → Q) ∧ R', 10, 116, { size: 18, bold: true });
  truth(ctx, 220, 98, { vars: ['P', 'Q', 'R'], goal: 1, cur: 1, rows: [[[0, 0, 0], 0], [[1, 1, 0], 0], [[1, 1, 1], 1]] });
  gate(ctx, 500, 116, 'xor', '?', { sel: true });
};
S['c-hud'] = ctx => {
  hud(ctx, { phase: '3-2', sn: 3, sector: 'PROTOCOLOS', alert: 4, max: 6, stars: 2 });
  toast(ctx, 10, 42, 200, 'ok', '✓', 'PORTA D1 ABERTA'); toast(ctx, 222, 42, 200, 'danger', '!', 'ALARME +1 · 5/6'); toast(ctx, 434, 42, 236, 'default', 'i', 'Scanner disponível: tecla Q');
  T(ctx, 'PROGRESSO', 10, 88, { size: 11, bold: true, color: C.dim });
  for (let i = 0; i < 10; i++) { const sx = 80 + i * 21; if (i < 4) rectF(ctx, sx, 84, 19, 8, C.ok); else rectS(ctx, sx, 84, 19, 8, C.border); }
  T(ctx, '4/10', 296, 88.5, { size: 12, bold: true });
  callout(ctx, 360, 74, 310, { step: 'PASSO 2/6', text: 'Mensagem contextual: âmbar = foco do tutorial.' });
};
S['c-mapa'] = ctx => {
  const items = [['#', null, 'parede'], ['.', null, 'chão'], ['.', { t: 'exit' }, 'saída'], ['.', { t: 'player' }, 'hacker'], ['.', { t: 'sw', n: 'P', v: 0 }, 'P = 0'], ['.', { t: 'sw', n: 'P', v: 1 }, 'P = 1'],
    ['.', { t: 'door' }, 'porta'], ['.', { t: 'door', open: true }, 'aberta'], ['_', { t: 'bridge' }, 'vão'], ['_', { t: 'bridge', ext: true }, 'ponte'], ['.', { t: 'plate', v: 0 }, 'placa'],
    ['.', { t: 'box' }, 'caixa'], ['#', { t: 'laser' }, 'laser'], ['#', { t: 'laser', off: true }, 'off'], ['.', { t: 'term' }, 'term.']];
  items.forEach(([g, e, l], i) => { const x = 10 + i * 44; level(ctx, { g: [g], e: e ? [Object.assign({ c: 0, r: 0 }, e)] : [] }, x, 8); T(ctx, l, x + 15, 52, { size: 11, color: C.dim, align: 'center' }); });
  // conectores
  ln(ctx, [[10, 72], [120, 72]], C.one, 1.5, [3, 3]); T(ctx, 'ligação = 1', 128, 72, { size: 11, color: C.dim });
  ln(ctx, [[230, 72], [340, 72]], C.zero, 1, [3, 3]); T(ctx, 'ligação = 0', 348, 72, { size: 11, color: C.dim });
  bracket(ctx, 470, 62, 20, 20); T(ctx, 'foco do tutorial', 500, 72, { size: 11, color: C.dim });
};

export function prep(cv) {
  const w = +cv.dataset.w || 680, h = +cv.dataset.h || 400, s = +cv.dataset.s || 1.5, d = window.devicePixelRatio || 1;
  cv.width = Math.round(w * s * d); cv.height = Math.round(h * s * d); cv.style.width = w * s + 'px'; cv.style.height = h * s + 'px';
  cv._cb = { w, h, k: s * d, ctx: cv.getContext('2d') }; return cv._cb;
}
export function drawCanvas(cv) {
  const m = cv._cb || prep(cv), ctx = m.ctx; ctx.setTransform(m.k, 0, 0, m.k, 0, 0); rectF(ctx, 0, 0, m.w, m.h, C.bg);
  FX.screen = cv.dataset.screen; fx('bg', ctx, m.w, m.h, FX.screen); const fn = S[FX.screen]; if (fn) fn(ctx, m.w, m.h);
}
export async function fontsReady() { try { await Promise.all(['400', '700'].map(w => document.fonts.load(`${w} 12px "JetBrains Mono"`))); } catch (e) {} }
export async function renderAll(root = document) { await fontsReady(); root.querySelectorAll('canvas[data-screen]').forEach(cv => { prep(cv); drawCanvas(cv); }); }
