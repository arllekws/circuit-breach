import type { Estatisticas, Progresso } from '../jogo/progresso';
import type { Fase } from '../jogo/tipos';
import { FX, fx } from './efeitos';
import { FASES_POR_LINHA } from './menu';
import type { RegiaoClicavel } from './layout';
import { button, estrela, footer, ln, panel, rectF, rectS, T, tab, TX, TY, W, wrapLines, type Ctx, type EstiloDeTexto } from './primitivas';
import { C } from './tema';

// Tela final (nova): relatório da invasão, com os números do progresso salvo.

const EQUIPE = ['Arllesson Gomes', 'Luan Martins', 'João Miguel Freitas'];

export function telaFinal(ctx: Ctx, fases: readonly Fase[], progresso: Progresso, estatisticas: Estatisticas): RegiaoClicavel[] {
  fx('fundo', ctx, 'final');
  // No modo invasão, cada texto ganha uma placa escura atrás para a chuva não atrapalhar a leitura.
  const placa = (s: string, x: number, y: number, o: EstiloDeTexto = {}, atraso?: number): number => {
    if (FX.ligado) {
      const tamanho = o.size ?? 12;
      const w = W(ctx, s, tamanho, o.bold ?? false);
      const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
      rectF(ctx, x0 - 4, y - tamanho * 0.75, w + 8, tamanho * 1.5, C.bg);
    }
    return atraso === undefined ? T(ctx, s, x, y, o) : TX(ctx, s, x, y, o, atraso);
  };

  const vencidas = fases.filter((f) => (progresso[f.id] ?? 0) > 0).length;
  const maximo = fases.length * 3;
  const estrelas = fases.reduce((s, f) => s + (progresso[f.id] ?? 0), 0);

  if (FX.ligado) rectF(ctx, 20, 16, W(ctx, '> breach --status', 11) + 16, 20, C.bg);
  TY(ctx, ['> breach --status'], 24, 26, { size: 11, color: C.dim }, Infinity, 24);
  tab(ctx, 24, 38, vencidas === fases.length ? 'SYSTEM COMPROMISED' : 'PARTIAL BREACH', vencidas === fases.length ? 'ok' : 'focus');
  placa('CIRCUIT', 24, 86, { size: 34, bold: true }, 0.4);
  placa('BREACH', 24, 122, { size: 34, bold: true, color: C.term }, 0.55);
  placa(vencidas === fases.length ? '> root access granted' : `> ${vencidas}/${fases.length} nodes breached`, 24, 154, { size: 14, bold: true, color: C.term });
  const mensagem =
    vencidas === fases.length
      ? 'Você atravessou os 5 setores usando só lógica proposicional.'
      : `Faltam ${fases.length - vencidas} fases para comprometer o sistema inteiro.`;
  wrapLines(ctx, mensagem, 296, 12).forEach((l, i) => placa(l, 24, 176 + i * 16, { color: C.text }));

  // Estrelas: contam até o total no modo invasão; estáticas sem ele.
  const mostradas = FX.ligado ? Math.max(0, Math.min(estrelas, Math.floor((FX.t - FX.t0 - 0.9) / 0.035))) : estrelas;
  if (FX.ligado) rectF(ctx, 18, 208, 310, 68, C.bg);
  estrela(ctx, 36, 226, 12, true);
  const nw = T(ctx, String(mostradas), 56, 226, { size: 30, bold: true });
  T(ctx, `/ ${maximo} estrelas`, 62 + nw, 229, { size: 12, color: C.dim });
  T(ctx, `${Math.round((mostradas / maximo) * 100)}%`, 320, 226, { size: 18, bold: true, align: 'right' });
  const celula = Math.floor(300 / maximo);
  for (let i = 0; i < maximo; i++) {
    const sx = 24 + i * celula;
    if (i < mostradas) rectF(ctx, sx, 246, celula - 2, 10, C.amber);
    else rectS(ctx, sx, 246, celula - 2, 10, C.border);
  }
  T(ctx, 'concluído', 320, 268, { size: 11, color: C.dim, align: 'right' });

  panel(ctx, 24, 284, 300, 86, { title: 'EQUIPE', meta: 'Lógica da Computação' });
  if (FX.ligado) {
    // Créditos sobem dentro do painel, em ciclo.
    const rolo: [string, boolean][] = [
      ['CRÉDITOS', true],
      ...EQUIPE.map((n): [string, boolean] => [n, false]),
      ['', false],
      ['DISCIPLINA', true],
      ['Lógica da Computação', false],
      ['', false],
      ['OBRIGADO POR JOGAR', true],
      ['', false],
    ];
    const H = rolo.length * 17;
    const desloc = (Math.max(0, FX.t - FX.t0) * 12) % H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(26, 302, 296, 66);
    ctx.clip();
    for (let k = 0; k < 2; k++) {
      rolo.forEach(([s, titulo], i) => {
        const yy = 312 + i * 17 - desloc + k * H;
        if (s !== '' && yy > 290 && yy < 380) T(ctx, s, 38, yy, { size: titulo ? 11 : 12, bold: true, color: titulo ? C.dim : C.text });
      });
    }
    ctx.restore();
  } else {
    EQUIPE.forEach((n, i) => T(ctx, n, 38, 312 + i * 17, { size: 12, bold: true }));
  }

  // Relatório por setor.
  panel(ctx, 348, 20, 316, 290, { title: 'BREACH REPORT // LOG', meta: `${vencidas}/${fases.length} NODES` });
  const setores = Math.ceil(fases.length / FASES_POR_LINHA);
  for (let s = 0; s < setores; s++) {
    const daLinha = fases.slice(s * FASES_POR_LINHA, (s + 1) * FASES_POR_LINHA);
    const y = 54 + s * 32;
    const concluido = daLinha.every((f) => (progresso[f.id] ?? 0) > 0);
    T(ctx, concluido ? '✓' : '·', 362, y, { size: 12, bold: true, color: concluido ? C.ok : C.dim });
    T(ctx, `S${s + 1}`, 378, y, { size: 11, color: C.dim });
    T(ctx, (daLinha[0]?.setor ?? '').toUpperCase(), 400, y, { size: 12, bold: true });
    let soma = 0;
    daLinha.forEach((f, j) => {
      const e = progresso[f.id] ?? 0;
      soma += e;
      for (let k = 0; k < 3; k++) estrela(ctx, 504 + j * 56 + k * 14, y, 5.5, k < e);
    });
    T(ctx, `${soma}/${daLinha.length * 3}`, 652, y, { size: 12, bold: true, align: 'right' });
    if (s < setores - 1) rectF(ctx, 362, y + 16, 290, 1, C.grid);
  }
  ln(ctx, [[362, 218], [652, 218]], C.border, 1, [2, 3]);

  const resultados = fases.map((f) => estatisticas[f.id]).filter((r) => r !== undefined);
  const trocas = resultados.reduce((s, r) => s + r.trocas, 0);
  const minimo = resultados.reduce((s, r) => s + r.minimo, 0);
  const alertas = resultados.reduce((s, r) => s + r.alerta, 0);
  const provasTotal = fases.reduce(
    (s, f) => s + f.desafios.reduce((t, d) => t + (d.desafio.tipo === 'prova' ? d.desafio.rodadas.length : 0), 0),
    0,
  );
  const provasFeitas = fases.reduce(
    (s, f) =>
      s + ((progresso[f.id] ?? 0) > 0 ? f.desafios.reduce((t, d) => t + (d.desafio.tipo === 'prova' ? d.desafio.rodadas.length : 0), 0) : 0),
    0,
  );
  const numeros: [string, string, string][] = [
    ['TROCAS', String(trocas), `mín. ${minimo}`],
    ['ALERTAS', String(alertas), `em ${resultados.length} fase${resultados.length === 1 ? '' : 's'}`],
    ['PROVAS', `${provasFeitas}/${provasTotal}`, 'núcleo'],
  ];
  numeros.forEach(([rotulo, valor, sub], i) => {
    const x = 362 + i * 100;
    T(ctx, rotulo, x, 236, { size: 11, color: C.dim });
    T(ctx, valor, x, 258, { size: 18, bold: true });
    T(ctx, sub, x, 280, { size: 11, color: C.dim });
  });

  placa('> session terminated. Obrigado por jogar.', 348, 330, { size: 11, color: C.dim });
  const voltar = { x: 348, y: 342, w: 316, h: 28 };
  button(ctx, voltar.x, voltar.y, voltar.w, voltar.h, 'RETURN TO MENU', 'confirm', { key: 'Enter' });
  footer(ctx, [
    ['Enter', 'menu'],
    ['R', 'replay log'],
    ['M', 'fx/terminal'],
  ]);
  return [{ r: voltar, acao: { tipo: 'confirmar' } }];
}
