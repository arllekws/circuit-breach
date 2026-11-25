import { botoesDeRegra, montarFormula, type Espelho, type EstadoDoDesafio, type Montagem, type Prova, type Terminais } from '../jogo/desafios';
import type { Estado } from '../jogo/tipos';
import { avaliar } from '../logica/avaliar';
import { formatar } from '../logica/formatar';
import { REGRAS } from '../logica/inferencia';
import { valoracoes, variaveis } from '../logica/tabelaVerdade';
import { paraBit, type Bit, type ConectivoBinario, type Valoracao } from '../logica/tipos';
import { altura, arvoreAvaliada, arvoreDoMolde } from './arvore';
import { hud } from './hud';
import type { RegiaoClicavel, Retangulo, Visual } from './layout';
import {
  button,
  chamfer,
  circuit,
  entrada,
  footer,
  key,
  ln,
  OPS,
  panel,
  rectF,
  rectS,
  T,
  tab,
  toast,
  val,
  W,
  wrap,
  wrapLines,
  type Ctx,
  type ItemDoRodape,
} from './primitivas';
import { C } from './tema';

// Telas dos desafios do Firewall (Setor 4) e do Núcleo (Setor 5). Cada uma desenha o
// desafio aberto e devolve as regiões clicáveis; a regra continua toda em jogo/desafios.ts.

type Aberto<T extends EstadoDoDesafio['tipo']> = Extract<EstadoDoDesafio, { tipo: T }>;

const OPERADOR: Readonly<Record<ConectivoBinario, keyof typeof OPS>> = { AND: 'and', OR: 'or', XOR: 'xor', IMP: 'imp', IFF: 'bic' };
const rotuloDaPorta = (c: ConectivoBinario): string => `${OPS[OPERADOR[c]][1].slice(0, 4)} ${OPS[OPERADOR[c]][0]}`;

/** Rodapé de teclas, ou a mensagem do último evento no lugar dele enquanto ela durar. */
function rodape(ctx: Ctx, visual: Visual, itens: readonly ItemDoRodape[]): void {
  const aviso = visual.aviso;
  if (aviso !== null && visual.agora < aviso.ate) toast(ctx, 170, 375, 340, aviso.variante, aviso.icone, aviso.texto);
  else footer(ctx, itens);
}

const bits = (v: Valoracao, nomes: readonly string[]): string => nomes.map((n) => `${n}=${v[n]}`).join('  ');

// ───────────────────────── Firewall · montagem ─────────────────────────

function montagem(ctx: Ctx, estado: Estado, d: Montagem, aberto: Aberto<'montagem'>, visual: Visual): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  const nomes = variaveis(d.alvo);
  const linhas = valoracoes(nomes);
  const montada = montarFormula(d.molde, aberto.escolhas);
  const alvoDe = (v: Valoracao): Bit => paraBit(avaliar(d.alvo, v));
  const seuDe = (v: Valoracao): Bit | null => (montada === null ? null : paraBit(avaliar(montada, v)));
  const batem = linhas.filter((v) => seuDe(v) === alvoDe(v)).length;
  // Linha inspecionada: a primeira que diverge; com espaços vazios, a primeira linha-alvo.
  const inspecionada =
    montada !== null
      ? Math.max(0, linhas.findIndex((v) => seuDe(v) !== alvoDe(v)))
      : Math.max(0, linhas.findIndex((v) => alvoDe(v) === 1));
  const vInspecao = linhas[inspecionada] ?? {};

  panel(ctx, 8, 34, 428, 338, {
    title: 'FIREWALL // CIRCUIT BUILD',
    meta: estado.erros > 0 ? `${estado.erros} FAIL${estado.erros > 1 ? 'S' : ''} ✕` : 'NO FAILS',
    metaColor: estado.erros > 0 ? C.danger : C.dim,
    metaBold: estado.erros > 0,
  });
  T(ctx, 'ALVO', 20, 64, { size: 11, bold: true, color: C.ok });
  T(ctx, d.descricao, 56, 64, { size: 12 });
  T(ctx, 'vale qualquer circuito equivalente', 56, 80, { size: 11, color: C.dim });

  // O circuito com os espaços, centralizado.
  const partes = d.molde
    .split(/(\?\d+)/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => (p.startsWith('?') ? Number(p.slice(1)) - 1 : p.replace(/NOT\s*/g, '¬').replace(/\s+/g, ' ')));
  const largura = Math.min(
    412,
    partes.reduce<number>((s, p) => s + (typeof p === 'number' ? 60 : W(ctx, p, 18, true)), 0) + 8 * (partes.length - 1),
  );
  let x = Math.round(8 + (428 - largura) / 2);
  const sy = 122;
  for (const parte of partes) {
    if (typeof parte === 'string') {
      x += T(ctx, parte, x, sy, { size: 18, bold: true }) + 8;
      continue;
    }
    const sel = parte === aberto.cursor;
    const escolha = aberto.escolhas[parte] ?? null;
    T(ctx, `ESP ${parte + 1}`, x + 30, sy - 24, { size: 11, bold: sel, color: sel ? C.amber : C.dim, align: 'center' });
    rectF(ctx, x, sy - 14, 60, 28, C.map);
    rectS(ctx, x, sy - 14, 60, 28, sel ? C.amber : escolha === null ? C.dim : C.text, sel ? 2 : 1, escolha === null && !sel ? [3, 3] : undefined);
    T(ctx, escolha === null ? '?' : rotuloDaPorta(escolha), x + 30, sy + 0.5, {
      size: 12,
      bold: true,
      color: sel ? C.amber : escolha === null ? C.dim : C.text,
      align: 'center',
    });
    regioes.push({ r: { x, y: sy - 26, w: 60, h: 40 }, acao: { tipo: 'selecionar', indice: parte } });
    x += 68;
  }
  ln(ctx, [[16, 146], [428, 146]], C.border, 1, [2, 3]);

  // A árvore viva, na linha inspecionada da tabela.
  T(ctx, `CIRCUITO NA LINHA  ${bits(vInspecao, nomes)}`, 20, 160, { size: 11, color: C.dim });
  const arvore = arvoreDoMolde(d.molde, aberto.escolhas, vInspecao, aberto.cursor);
  const gw = Math.min(92, Math.floor((330 - 48) / Math.max(1, altura(arvore))) - 8);
  const fim = circuit(ctx, 24, 172, arvore, { gw });
  const alvoAqui = alvoDe(vInspecao);
  const igual = arvore.v === alvoAqui;
  T(ctx, arvore.v === '?' ? '?' : igual ? '=' : '≠', fim.x2 + 8, fim.cy + 0.5, {
    size: 14,
    bold: true,
    color: arvore.v === '?' ? C.dim : igual ? C.ok : C.danger,
    align: 'center',
  });
  T(ctx, 'ALVO', fim.x2 + 34, fim.cy - 17, { size: 11, bold: true, color: C.ok, align: 'center' });
  val(ctx, fim.x2 + 24, fim.cy - 8, alvoAqui, 20, 13);

  // Paleta de portas (teclas 1, 2, 3…) para o espaço sob o cursor.
  T(ctx, `PORTA PARA O ESPAÇO ${aberto.cursor + 1}`, 20, 278, { size: 11, color: C.dim });
  const bw = Math.min(124, Math.floor((404 - (d.opcoes.length - 1) * 8) / d.opcoes.length));
  d.opcoes.forEach((opcao, i) => {
    const r = { x: 20 + i * (bw + 8), y: 288, w: bw, h: 28 };
    const escolhida = aberto.escolhas[aberto.cursor] === opcao;
    button(ctx, r.x, r.y, r.w, r.h, rotuloDaPorta(opcao), escolhida ? 'selected' : 'default', { key: String(i + 1) });
    regioes.push({ r, acao: { tipo: 'escolherPorta', espaco: aberto.cursor, porta: opcao } });
  });
  const testar = { x: 20, y: 328, w: 200, h: 30 };
  button(ctx, testar.x, testar.y, testar.w, testar.h, 'TESTAR CIRCUITO', montada === null ? 'disabled' : 'confirm', { key: 'Enter' });
  if (montada !== null) regioes.push({ r: testar, acao: { tipo: 'confirmar' } });
  const vazios = aberto.escolhas.filter((e) => e === null).length;
  T(ctx, montada === null ? `faltam ${vazios} espaço${vazios > 1 ? 's' : ''}` : `prévia: ${batem} de ${linhas.length} linhas`, 232, 343.5, {
    size: 11,
    color: C.dim,
  });

  // Tabela-verdade: alvo × seu circuito.
  panel(ctx, 444, 34, 228, 338, {
    title: 'TRUTH TABLE // DIFF',
    meta: montada === null ? 'INCOMPLETE' : `${batem}/${linhas.length} OK`,
    metaColor: montada === null ? C.dim : batem === linhas.length ? C.ok : C.danger,
    metaBold: montada !== null,
  });
  const colVar = (i: number): number => 468 + i * 30;
  const colAlvo = colVar(nomes.length) + 20;
  const colSeu = colAlvo + 50;
  const colMarca = colSeu + 46;
  nomes.forEach((n, i) => T(ctx, n, colVar(i), 66, { size: 11, bold: true, color: C.dim, align: 'center' }));
  T(ctx, 'ALVO', colAlvo, 66, { size: 11, bold: true, color: C.ok, align: 'center' });
  T(ctx, 'SEU', colSeu, 66, { size: 11, bold: true, color: C.dim, align: 'center' });
  rectF(ctx, 454, 76, 210, 1, C.border);
  const rh = Math.min(32, Math.floor(150 / linhas.length));
  const tam = rh >= 26 ? 16 : 11;
  linhas.forEach((v, i) => {
    const ry = 98 + i * rh;
    const seu = seuDe(v);
    const alvo = alvoDe(v);
    const certo = seu !== null && seu === alvo;
    if (i === inspecionada) {
      rectF(ctx, 454, ry - rh / 2 + 3, 210, rh - 6, C.grid);
      T(ctx, '▸', 447, ry, { size: 12, bold: true, color: C.amber });
    }
    rectS(ctx, 454, ry - rh / 2 + 3, 210, rh - 6, seu === null ? C.border : certo ? C.ok : C.danger);
    nomes.forEach((n, j) => T(ctx, String(v[n]), colVar(j), ry + 0.5, { size: tam, bold: true, color: v[n] === 1 ? C.one : C.dim, align: 'center' }));
    T(ctx, String(alvo), colAlvo, ry + 0.5, { size: tam, bold: true, color: alvo === 1 ? C.one : C.dim, align: 'center' });
    T(ctx, seu === null ? '?' : String(seu), colSeu, ry + 0.5, { size: tam, bold: true, color: seu === 1 ? C.one : C.dim, align: 'center' });
    if (seu !== null) T(ctx, certo ? '✓' : '✕', colMarca, ry + 0.5, { size: 14, bold: true, color: certo ? C.ok : C.danger, align: 'center' });
  });
  const segmento = Math.floor((208 - (linhas.length - 1) * 4) / linhas.length);
  linhas.forEach((v, i) => {
    const sx = 456 + i * (segmento + 4);
    const seu = seuDe(v);
    if (seu === null) rectS(ctx, sx, 236, segmento, 8, C.border);
    else rectF(ctx, sx, 236, segmento, 8, seu === alvoDe(v) ? C.ok : C.danger);
  });
  T(ctx, montada === null ? 'monte o circuito para comparar' : `${batem} de ${linhas.length} linhas batem com o alvo`, 456, 258, { size: 11 });
  tab(ctx, 452, 278, 'DIAGNOSTIC // LOG');
  const divergentes = linhas.filter((v) => seuDe(v) !== null && seuDe(v) !== alvoDe(v)).map((v) => nomes.map((n) => v[n]).join(''));
  const diagnostico =
    montada === null
      ? `Escolha uma porta para cada espaço (ESP 1 a ESP ${d.espacos}). A tabela compara linha a linha.`
      : divergentes.length === 0
        ? 'Todas as linhas batem: o circuito é equivalente ao alvo. Teste com Enter.'
        : `As linhas ${divergentes.join(', ')} divergem. Revise os espaços e teste de novo.`;
  wrap(ctx, diagnostico, 456, 310, 206, { size: 12, lh: 16 });

  rodape(ctx, visual, [
    [['←', '→'], 'espaço'],
    [['↑', '↓'], 'porta'],
    [d.opcoes.map((_, i) => String(i + 1)), 'escolher'],
    ['Enter', 'testar'],
    ['Esc', 'mapa'],
  ]);
  return regioes;
}

// ───────────────────────── Firewall espelhado ─────────────────────────

function espelhado(ctx: Ctx, d: Espelho, aberto: Aberto<'espelho'>, visual: Visual): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  const rodada = d.rodadas[aberto.rodada];
  if (rodada === undefined) return regioes;
  const nomes = variaveis(rodada.original, ...rodada.cabos).slice(0, 3);
  const bancada: Valoracao = Object.fromEntries(nomes.map((n) => [n, visual.bancada[n] ?? 1]));

  // Bancada: valores só para visualizar (não contam troca nem alerta).
  panel(ctx, 8, 40, 170, 82, { title: 'BANCADA' });
  nomes.forEach((n, i) => {
    entrada(ctx, 22 + i * 50, 66, n, bancada[n] ?? 0);
    key(ctx, 32 + i * 50, 96, String(i + 1));
  });
  T(ctx, 'alternam', 22 + nomes.length * 50, 104.5, { size: 11, color: C.dim });

  const valorOriginal = paraBit(avaliar(rodada.original, bancada));
  panel(ctx, 196, 40, 288, 82, { title: 'ORIGINAL PANEL' });
  T(ctx, formatar(rodada.original), 330, 78, { size: 22, bold: true, align: 'center' });
  T(ctx, '=', 410, 78, { size: 14, bold: true, color: C.dim });
  val(ctx, 424, 67, valorOriginal, 22, 14);
  T(ctx, 'equivalente = mesma tabela-verdade', 340, 106, { size: 11, color: C.dim, align: 'center' });

  panel(ctx, 502, 40, 170, 82, { title: `ROUND ${aberto.rodada + 1}/${d.rodadas.length}` });
  for (let i = 0; i < d.rodadas.length; i++) {
    const px = 516 + i * 34;
    const atual = i === aberto.rodada;
    const feita = i < aberto.rodada;
    rectS(ctx, px, 62, 26, 26, atual ? C.amber : feita ? C.ok : C.border, atual ? 2 : 1);
    T(ctx, feita ? '✓' : String(i + 1), px + 13, 75.5, { size: 13, bold: true, color: atual ? C.amber : feita ? C.ok : C.dim, align: 'center' });
  }
  T(ctx, 'cabo errado: +1 alerta', 516, 104, { size: 11, color: C.dim });

  const n = rodada.cabos.length;
  const w = Math.floor((664 - (n - 1) * 8) / n);
  rodada.cabos.forEach((cabo, i) => {
    const x = 8 + i * (w + 8);
    const sel = i === aberto.cursor;
    const tracejado = i % 2 === 1;
    // Fio do painel até o cabo: contínuo ou tracejado (não depende só da cor).
    ln(ctx, [[340, 122], [340, 134], [x + w / 2, 134], [x + w / 2, 146]], sel ? C.amber : C.border, 2, tracejado ? [5, 4] : undefined);
    panel(ctx, x, 146, w, 222, { v: sel ? 'focus' : 'default', title: `CABO ${i + 1}`, meta: tracejado ? 'tracejado' : 'contínuo' });
    T(ctx, formatar(cabo), x + w / 2, 186, { size: 18, bold: true, align: 'center' });
    const arvore = arvoreAvaliada(cabo, bancada);
    const gw = Math.min(92, Math.floor((w - 76 - 48) / Math.max(1, altura(arvore))) - 8);
    circuit(ctx, x + 38, 208, arvore, { gw });
    ln(ctx, [[x + 14, 262], [x + w - 14, 262]], C.border, 1, [2, 3]);
    const valorCabo = paraBit(avaliar(cabo, bancada));
    T(ctx, 'NA BANCADA', x + 14, 280, { size: 11, color: C.dim });
    val(ctx, x + 96, 271, valorCabo, 18, 12);
    T(ctx, valorCabo === valorOriginal ? '= painel nesta linha' : '≠ painel nesta linha', x + 122, 280.5, {
      size: 11,
      color: valorCabo === valorOriginal ? C.text : C.danger,
    });
    T(ctx, 'uma linha igual não prova equivalência', x + 14, 298, { size: 11, color: C.dim });
    const botao = { x: x + 14, y: 320, w: w - 28, h: 30 };
    button(ctx, botao.x, botao.y, botao.w, botao.h, `LIGAR CABO ${i + 1}`, sel ? 'selected' : 'default', sel ? { key: 'Enter' } : {});
    regioes.push({ r: botao, acao: { tipo: 'escolherCabo', indice: i } });
    regioes.push({ r: { x, y: 146, w, h: 170 }, acao: { tipo: 'selecionar', indice: i } });
  });

  rodape(ctx, visual, [
    [['←', '→'], 'cabo'],
    [nomes.map((_, i) => String(i + 1)), 'bancada'],
    ['Enter', 'ligar'],
    ['Esc', 'mapa'],
  ]);
  return regioes;
}

// ───────────────────────── Terminais ─────────────────────────

function terminais(ctx: Ctx, d: Terminais, aberto: Aberto<'terminais'>, visual: Visual): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  T(ctx, 'REGRA', 12, 46, { size: 11, bold: true, color: C.dim });
  T(ctx, 'Confiável sempre diz a verdade; comprometido sempre mente. Se A diz φ, vale A ↔ φ.', 56, 46, { size: 11 });
  const n = d.terminais.length;
  const w = Math.floor((664 - (n - 1) * 8) / n);
  const largo = w >= 300;
  d.terminais.forEach((terminal, i) => {
    const x = 8 + i * (w + 8);
    const sel = i === aberto.cursor;
    const marca = aberto.marcas[i] ?? null;
    panel(ctx, x, 60, w, 262, {
      v: sel ? 'focus' : 'default',
      title: `TERMINAL ${terminal.nome}`,
      meta: marca === null ? 'NÃO MARCADO' : 'MARCADO',
      metaColor: marca === null ? C.dim : C.text,
      metaBold: marca !== null,
    });
    regioes.push({ r: { x, y: 60, w, h: 180 }, acao: { tipo: 'selecionar', indice: i } });
    T(ctx, 'FALA', x + 14, 96, { size: 11, bold: true, color: C.dim });
    const hFala = wrap(ctx, `“${terminal.fala}”`, x + 14, 118, w - 28, { size: 14, bold: true, lh: 18 });
    const yt = Math.max(146, 118 + hFala - 4);
    ln(ctx, [[x + 14, yt], [x + w - 14, yt]], C.border, 1, [2, 3]);
    T(ctx, 'TRADUÇÃO LÓGICA', x + 14, yt + 18, { size: 11, bold: true, color: C.dim });
    T(ctx, formatar(terminal.formula), x + 14, yt + 44, { size: largo ? 22 : 18, bold: true });
    const nomes = variaveis(terminal.formula);
    wrap(ctx, `${nomes.join(', ')} = 1: confiável · = 0: comprometido`, x + 14, yt + 72, w - 28, { size: 11, color: C.dim, lh: 14 });

    // CONFIÁVEL · 1 / COMPROMETIDO · 0 (lado a lado, ou empilhados nos cartões estreitos).
    const opcoes: [string, Bit, string][] = [
      ['CONFIÁVEL', 1, '↑'],
      ['COMPROMETIDO', 0, '↓'],
    ];
    opcoes.forEach(([rotulo, valor, tecla], k) => {
      const r: Retangulo = largo ? { x: x + 14 + k * 154, y: 278, w: 146, h: 30 } : { x: x + 14, y: 248 + k * 34, w: w - 28, h: 30 };
      const marcado = marca === valor;
      chamfer(ctx, r.x, r.y, r.w, r.h, 5, C.map, marcado ? C.amber : C.border, marcado ? 2 : 1);
      val(ctx, r.x + 8, r.y + 7, valor, 16, 11);
      T(ctx, rotulo, r.x + 30, r.y + 15.5, { size: 11, bold: true, color: marcado ? C.amber : C.text });
      if (sel) key(ctx, r.x + r.w - 24, r.y + 7, tecla);
      regioes.push({ r, acao: { tipo: 'marcar', indice: i, valor } });
    });
  });
  const marcados = aberto.marcas.filter((m) => m !== null).length;
  const conferir = { x: 210, y: 334, w: 260, h: 30 };
  const completo = marcados === n;
  button(ctx, conferir.x, conferir.y, conferir.w, conferir.h, 'CONFERIR MARCAÇÃO', completo ? 'confirm' : 'disabled', { key: 'Enter' });
  if (completo) regioes.push({ r: conferir, acao: { tipo: 'confirmar' } });
  T(ctx, `${marcados} de ${n} marcados`, 482, 349.5, { size: 11, color: C.dim });
  rodape(ctx, visual, [
    [['←', '→'], 'terminal'],
    ['↑', 'confiável'],
    ['↓', 'comprometido'],
    ['Enter', 'conferir'],
    ['Esc', 'mapa'],
  ]);
  // Os botões ficam dentro dos cartões: invertendo a lista, o clique acha primeiro o botão.
  return regioes.reverse();
}

// ───────────────────────── Núcleo Central ─────────────────────────

function nucleo(ctx: Ctx, d: Prova, aberto: Aberto<'prova'>, visual: Visual): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  const pedida = d.rodadas[aberto.rodada];
  if (pedida === undefined) return regioes;
  panel(ctx, 8, 34, 440, 338, {
    title: `CORE // PROOF ${aberto.rodada + 1}/${d.rodadas.length}`,
    meta: 'invalid step: +1 ALERT',
  });

  // Linhas da prova: premissas com o log completo (sem reticências); derivadas com a regra.
  interface Bloco {
    i: number;
    h: number;
    log: string[];
  }
  const blocos: (Bloco | 'separador')[] = [];
  aberto.linhas.forEach((linha, i) => {
    const premissa = linha.regra === undefined ? pedida.premissas[i] : undefined;
    if (linha.regra !== undefined && aberto.linhas[i - 1]?.regra === undefined) blocos.push('separador');
    const log = premissa !== undefined && premissa.log !== '' ? wrapLines(ctx, `log: ${premissa.log}`, 356, 11) : [];
    blocos.push({ i, h: 26 + log.length * 14, log });
  });
  const alturaDe = (b: Bloco | 'separador'): number => (b === 'separador' ? 16 : b.h + 4);
  const total = blocos.reduce((s, b) => s + alturaDe(b), 0) + 30;
  const topo = 58;
  const visivel = 372 - 8 - topo;
  // Rolagem: mantém a linha sob o cursor à vista quando a prova cresce.
  let deslocamento = 0;
  if (total > visivel) {
    let acima = 0;
    for (const b of blocos) {
      if (b !== 'separador' && b.i === aberto.cursor) break;
      acima += alturaDe(b);
    }
    deslocamento = Math.min(Math.max(0, acima - visivel / 2), total - visivel);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(10, topo - 2, 436, visivel + 2);
  ctx.clip();
  let y = topo - deslocamento;
  for (const b of blocos) {
    if (b === 'separador') {
      T(ctx, 'DERIVADAS', 20, y + 6, { size: 11, bold: true, color: C.dim });
      ln(ctx, [[92, y + 6], [436, y + 6]], C.border, 1, [2, 3]);
      y += 16;
      continue;
    }
    const linha = aberto.linhas[b.i];
    if (linha === undefined) continue;
    const marcada = aberto.selecionadas.includes(b.i);
    if (b.i === aberto.cursor) {
      rectF(ctx, 14, y, 428, b.h, C.map);
      rectF(ctx, 14, y, 2, b.h, C.amber);
    }
    if (marcada) {
      rectF(ctx, 22, y + 6, 14, 14, C.amber);
      T(ctx, '✓', 29, y + 13.5, { size: 11, bold: true, color: C.ink, align: 'center' });
    } else rectS(ctx, 22, y + 6, 14, 14, C.dim);
    T(ctx, `${b.i + 1}.`, 44, y + 13.5, { size: 12, color: C.dim });
    T(ctx, formatar(linha.formula), 66, y + 13.5, { size: 14, bold: true });
    if (linha.regra !== undefined) {
      const etiqueta = `${linha.regra} · ${(linha.usadas ?? []).join(', ')}`;
      const tw = W(ctx, etiqueta, 11, true) + 12;
      rectS(ctx, 436 - tw, y + 5, tw, 16, C.text);
      T(ctx, etiqueta, 436 - tw / 2, y + 13.5, { size: 11, bold: true, align: 'center' });
    } else T(ctx, 'PREMISSA', 436, y + 13.5, { size: 11, color: C.dim, align: 'right' });
    b.log.forEach((s, k) => T(ctx, s, 66, y + 30 + k * 14, { size: 11, color: C.dim }));
    const yVisivel = Math.max(y, topo);
    const hVisivel = Math.min(y + b.h, topo + visivel) - yVisivel;
    if (hVisivel > 0) regioes.push({ r: { x: 14, y: yVisivel, w: 428, h: hVisivel }, acao: { tipo: 'selecionar', indice: b.i } });
    y += b.h + 4;
  }
  rectS(ctx, 14, y + 2, 428, 26, aberto.recusa !== null ? C.danger : C.border, 1, [3, 3]);
  T(ctx, `${aberto.linhas.length + 1}.`, 44, y + 15.5, { size: 12, color: C.dim });
  T(ctx, aberto.recusa ?? 'marque linhas e aplique uma regra', 66, y + 15.5, {
    size: 11,
    color: aberto.recusa !== null ? C.danger : C.dim,
  });
  ctx.restore();

  // Meta, regras e a regra selecionada.
  panel(ctx, 456, 34, 216, 58, { v: 'ok', title: 'META' });
  T(ctx, formatar(pedida.meta), 564, 64, { size: 22, bold: true, color: C.ok, align: 'center' });
  T(ctx, 'derive para abrir o núcleo', 564, 82, { size: 11, color: C.dim, align: 'center' });
  T(ctx, 'REGRAS DE INFERÊNCIA', 458, 106, { size: 11, bold: true, color: C.dim });
  const botoes = botoesDeRegra(pedida);
  botoes.forEach((botao, i) => {
    const r = { x: 456 + (i % 2) * 112, y: 116 + Math.floor(i / 2) * 28, w: 104, h: 24 };
    button(ctx, r.x, r.y, r.w, r.h, botao.rotulo, i === aberto.botao ? 'selected' : 'default', { size: botao.rotulo.length > 9 ? 11 : 12 });
    regioes.push({ r, acao: { tipo: 'aplicarRegra', botao: i } });
  });
  const escolhido = botoes[aberto.botao];
  const yRegra = Math.max(234, 116 + Math.ceil(botoes.length / 2) * 28 + 6);
  if (escolhido !== undefined) {
    const regra = REGRAS[escolhido.regra];
    panel(ctx, 456, yRegra, 216, 372 - yRegra, { title: regra.nome.toUpperCase() });
    const [antes, conclusao] = regra.esquema.split('⊢').map((s) => s.trim());
    const premissas = (antes ?? '').split(',').map((s) => s.trim());
    premissas.forEach((p, k) => T(ctx, p, 470, yRegra + 32 + k * 20, { size: 14, bold: true }));
    const yTraco = yRegra + 32 + premissas.length * 20 - 8;
    rectF(ctx, 470, yTraco, 60, 1, C.text);
    T(ctx, `⊢ ${conclusao ?? ''}`, 470, yTraco + 14, { size: 14, bold: true });
    T(ctx, 'REQUER', 570, yRegra + 28, { size: 11, color: C.dim });
    T(ctx, `${regra.premissas} linha${regra.premissas > 1 ? 's' : ''}`, 570, yRegra + 44, { size: 12 });
    T(ctx, 'MARCADAS', 570, yRegra + 64, { size: 11, color: C.dim });
    T(ctx, aberto.selecionadas.length === 0 ? '—' : aberto.selecionadas.map((i) => i + 1).join(', '), 570, yRegra + 80, {
      size: 12,
      bold: true,
      color: C.amber,
    });
    const pronto = aberto.selecionadas.length === regra.premissas;
    const aplicar = { x: 466, y: 334, w: 196, h: 28 };
    button(ctx, aplicar.x, aplicar.y, aplicar.w, aplicar.h, `APLICAR ${escolhido.regra}`, pronto ? 'confirm' : 'default', { key: 'Enter' });
    regioes.push({ r: aplicar, acao: { tipo: 'aplicarRegra', botao: aberto.botao } });
  }
  rodape(ctx, visual, [
    [['↑', '↓'], 'linha'],
    ['E', 'marcar'],
    [['←', '→'], 'regra'],
    ['Enter', 'aplicar'],
    ['Esc', 'mapa'],
  ]);
  return regioes;
}

/** Desenha o desafio aberto (HUD incluso) e devolve as regiões clicáveis. */
export function telaDeDesafio(ctx: Ctx, estado: Estado, visual: Visual): RegiaoClicavel[] {
  const aberto = estado.desafio;
  const definicao = estado.fase.desafios.find((t) => t.nome === aberto?.nome)?.desafio;
  hud(ctx, estado);
  if (aberto === null || definicao === undefined) return [];
  if (aberto.tipo === 'montagem' && definicao.tipo === 'montagem') return montagem(ctx, estado, definicao, aberto, visual);
  if (aberto.tipo === 'espelho' && definicao.tipo === 'espelho') return espelhado(ctx, definicao, aberto, visual);
  if (aberto.tipo === 'terminais' && definicao.tipo === 'terminais') return terminais(ctx, definicao, aberto, visual);
  if (aberto.tipo === 'prova' && definicao.tipo === 'prova') return nucleo(ctx, definicao, aberto, visual);
  return [];
}
