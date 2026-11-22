import { faseLiberada, totalDeEstrelas, type Progresso } from '../jogo/progresso';
import type { Fase } from '../jogo/tipos';
import { arvoreAvaliada, type NoExibido, type Operador } from './arvore';
import { fx } from './efeitos';
import { numeroDoSetor } from './hud';
import type { RegiaoClicavel } from './layout';
import {
  button,
  cadeado,
  chamfer,
  estrela,
  footer,
  OPS,
  panel,
  rectF,
  rectS,
  T,
  TX,
  TY,
  wrapLines,
  type Ctx,
} from './primitivas';
import { C } from './tema';

// Menu: à esquerda o status, o progresso e a fase escolhida; à direita o barramento dos
// setores, com duas fases por setor.

export const FASES_POR_LINHA = 2;

const DESAFIO: Readonly<Record<string, string>> = {
  montagem: 'MONTAGEM',
  espelho: 'EQUIVALÊNCIA',
  terminais: 'TERMINAIS',
  prova: 'INFERÊNCIA',
};

function operadoresDaFase(fase: Fase): Set<Exclude<Operador, 'unk'>> {
  const usados = new Set<Exclude<Operador, 'unk'>>();
  const visitar = (no: NoExibido): void => {
    if ('in' in no) return;
    if (no.op !== 'unk') usados.add(no.op);
    no.a.forEach(visitar);
  };
  for (const c of [...fase.portas, ...fase.lasers]) visitar(arvoreAvaliada(c.formula, fase.entradas));
  return usados;
}

/** O que a fase apresenta de novo: um conectivo que ainda não apareceu, ou o tipo de desafio. */
function novidade(fases: readonly Fase[], indice: number): string {
  const fase = fases[indice];
  if (fase === undefined) return '';
  const desafio = fase.desafios[0];
  if (desafio !== undefined) return DESAFIO[desafio.desafio.tipo] ?? '';
  const vistos = new Set(fases.slice(0, indice).flatMap((f) => [...operadoresDaFase(f)]));
  const novos = [...operadoresDaFase(fase)].filter((op) => !vistos.has(op));
  if (novos.length === 0) return fase.placas.length > 0 ? 'PLACA' : fase.lasers.length > 0 ? 'LASER' : 'REVISÃO';
  return novos.map((op) => `${OPS[op][0]} ${OPS[op][1]}`).join('  ');
}

export function desenharMenu(ctx: Ctx, fases: readonly Fase[], progresso: Progresso, selecionada: number): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  const ids = fases.map((f) => f.id);
  const vencidas = fases.filter((f) => (progresso[f.id] ?? 0) > 0).length;
  const total = totalDeEstrelas(progresso);
  const proximaSetor = fases.find((f) => (progresso[f.id] ?? 0) === 0);

  fx('fundo', ctx, 'menu');
  TY(
    ctx,
    [
      '// LAB-07 · SISTEMA DE SEGURANÇA',
      '// conectando ao LAB-07 ...',
      `// ${vencidas} de ${fases.length} fases comprometidas`,
      proximaSetor === undefined
        ? '// todos os setores invadidos'
        : `// setor ${numeroDoSetor(proximaSetor.id)} · ${proximaSetor.setor.toUpperCase()} aguardando invasão`,
    ],
    16,
    22,
    { size: 11, color: C.dim },
  );
  TX(ctx, 'CIRCUIT', 16, 54, { size: 30, bold: true }, 0.1);
  const bw = TX(ctx, 'BREACH', 16, 86, { size: 30, bold: true }, 0.3);
  rectF(ctx, 16 + bw + 6, 74, 12, 24, C.amber);
  T(ctx, 'O Hacker Lógico', 16, 114, { size: 14 });

  panel(ctx, 16, 134, 220, 70, { title: 'PROGRESSO', meta: `${vencidas}/${fases.length} FASES` });
  estrela(ctx, 30, 168, 9, true);
  const tw = T(ctx, String(total), 46, 168, { size: 22, bold: true });
  T(ctx, `/ ${fases.length * 3} estrelas`, 50 + tw, 169, { size: 12, color: C.dim });
  const seg = Math.floor((200 - (fases.length - 1) * 2) / fases.length);
  fases.forEach((f, i) => {
    const sx = 24 + i * (seg + 2);
    if ((progresso[f.id] ?? 0) > 0) rectF(ctx, sx, 186, seg, 8, C.ok);
    else rectS(ctx, sx, 186, seg, 8, C.border);
  });

  // Fase escolhida.
  const escolhida = fases[selecionada];
  const liberada = faseLiberada(ids, progresso, selecionada);
  panel(ctx, 16, 214, 220, 152, { v: 'focus', title: 'ALVO SELECIONADO' });
  if (escolhida !== undefined) {
    T(ctx, escolhida.id, 28, 248, { size: 24, bold: true, color: liberada ? C.amber : C.dim });
    const titulo = wrapLines(ctx, escolhida.titulo, 196, 14, true);
    T(ctx, titulo[0] ?? '', 28, 274, { size: 14, bold: true, color: liberada ? C.text : C.dim });
    T(ctx, `SETOR ${numeroDoSetor(escolhida.id)} · ${escolhida.setor.toUpperCase()}`, 28, 292, { size: 11, color: C.dim });
    T(ctx, 'NOVIDADE', 28, 312, { size: 11, color: C.dim });
    T(ctx, novidade(fases, selecionada), 96, 312, { size: 12, bold: true });
    const botao = { x: 28, y: 328, w: 196, h: 26 };
    button(ctx, botao.x, botao.y, botao.w, botao.h, liberada ? 'INVADIR' : 'BLOQUEADA', liberada ? 'confirm' : 'disabled', liberada ? { key: 'Enter' } : {});
    if (liberada) regioes.push({ r: botao, acao: { tipo: 'confirmar' } });
  }

  // Barramento dos setores.
  const setores = Math.ceil(fases.length / FASES_POR_LINHA);
  rectF(ctx, 266, 45, 1, 72 * (setores - 1) + 1, C.border);
  fx('barramento', ctx);
  for (let s = 0; s < setores; s++) {
    const daLinha = fases.slice(s * FASES_POR_LINHA, (s + 1) * FASES_POR_LINHA);
    const primeira = daLinha[0];
    if (primeira === undefined) continue;
    const y0 = 14 + s * 72;
    const ny = y0 + 24;
    const concluido = daLinha.every((f) => (progresso[f.id] ?? 0) > 0);
    const aberto = faseLiberada(ids, progresso, s * FASES_POR_LINHA);
    if (!aberto) {
      rectF(ctx, 261, ny, 11, 11, C.bg);
      rectS(ctx, 261, ny, 11, 11, C.border);
    } else rectF(ctx, 261, ny, 11, 11, concluido ? C.ok : C.amber);
    rectF(ctx, 276, y0 + 10, 80, 38, C.bg); // placa escura atrás do rótulo (some a chuva do modo invasão)
    T(ctx, `SETOR ${s + 1}`, 280, y0 + 20, { size: 11, color: C.dim });
    T(ctx, primeira.setor.toUpperCase(), 280, y0 + 38, { size: 12, bold: true, color: aberto ? C.text : C.dim });

    daLinha.forEach((fase, j) => {
      const i = s * FASES_POR_LINHA + j;
      const x = 360 + j * 156;
      const w = 148;
      const h = 58;
      const livre = faseLiberada(ids, progresso, i);
      const sel = i === selecionada;
      if (!livre) {
        chamfer(ctx, x, y0, w, h, 6, C.bg, sel ? C.amber : C.border, sel ? 2 : 1, [3, 3]);
        cadeado(ctx, x + w - 16, y0 + 17, C.dim);
      } else chamfer(ctx, x, y0, w, h, 6, C.panel, sel ? C.amber : C.border, sel ? 2 : 1);
      T(ctx, (sel ? '▸ ' : '') + fase.id, x + 10, y0 + 17, { size: 14, bold: true, color: sel ? C.amber : livre ? C.text : C.dim });
      const titulo = wrapLines(ctx, fase.titulo, w - 20, 12);
      if (titulo.length === 1) T(ctx, titulo[0] ?? '', x + 10, y0 + 39, { size: 12, color: livre ? C.text : C.dim });
      else {
        wrapLines(ctx, fase.titulo, w - 20, 11)
          .slice(0, 2)
          .forEach((l, k) => T(ctx, l, x + 10, y0 + 34 + k * 13, { size: 11, color: livre ? C.text : C.dim }));
      }
      if (livre) for (let k = 0; k < 3; k++) estrela(ctx, x + w - 46 + k * 16, y0 + 17, 6, k < (progresso[fase.id] ?? 0));
      regioes.push({ r: { x, y: y0, w, h }, acao: { tipo: 'selecionar', indice: i } });
    });
  }

  footer(ctx, [
    [['←↑↓→', 'WASD'], 'escolher fase'],
    ['Enter', 'invadir'],
    ['M', 'efeitos'],
  ]);
  return regioes;
}
