import { estrelasPara, limiteAlerta } from '../jogo/regras';
import type { Estado } from '../jogo/tipos';
import { AREA_MAPA, TELA, type RegiaoClicavel, type Visual } from './layout';
import { button, estrela, ln, panel, rectF, rectS, T, toast, TX, type Ctx } from './primitivas';
import { C } from './tema';

/** Número do setor a partir do id da fase ("3-2" → "3"). */
export const numeroDoSetor = (id: string): string => id.split('-')[0] ?? '';

/** Barra superior: fase e setor, nível de alerta segmentado, estrelas ainda possíveis. */
export function hud(ctx: Ctx, estado: Estado): void {
  const { fase } = estado;
  rectF(ctx, 0, 0, TELA.w, 28, C.panel);
  rectF(ctx, 0, 28, TELA.w, 1, C.border);
  rectF(ctx, 0, 27, TELA.w, 1, C.grid);
  let x = 10;
  x += T(ctx, `> FASE ${fase.id}`, x, 14.5, { size: 13, bold: true, color: C.term }) + 10;
  T(ctx, `SETOR ${numeroDoSetor(fase.id)} // ${fase.setor.toUpperCase()}`, x, 14.5, { size: 11, color: C.dim });

  // Alerta: vermelho cheio = usado, contorno = livre.
  const maximo = Math.max(1, limiteAlerta(fase));
  const alerta = Math.min(estado.alerta, maximo);
  const ax = 318;
  const sw = Math.max(4, Math.floor((110 - (maximo - 1) * 3) / maximo));
  T(ctx, 'ALERTA', 268, 14.5, { size: 11, bold: true, color: C.dim });
  for (let i = 0; i < maximo; i++) {
    const sx = ax + i * (sw + 3);
    if (i < alerta) rectF(ctx, sx, 9, sw, 11, C.danger);
    else rectS(ctx, sx, 9, sw, 11, C.border);
  }
  T(ctx, `${estado.alerta}/${maximo}`, ax + maximo * (sw + 3) + 6, 14.5, {
    size: 12,
    bold: true,
    color: estado.alerta >= maximo - 1 ? C.danger : C.text,
  });

  // Estrelas que o jogador ainda leva se terminar agora (âmbar = possível, contorno = perdida).
  const possiveis =
    estado.situacao === 'vitoria' ? estado.estrelas : estrelasPara(estado.trocas, fase.minimo, estado.erros);
  T(ctx, 'RANK', 608, 14.5, { size: 11, bold: true, color: C.dim, align: 'right' });
  for (let i = 0; i < 3; i++) estrela(ctx, 624 + i * 18, 14, 7.5, i < possiveis);
}

/** Mensagem curta no pé do mapa (porta aberta, alarme…). */
export function avisoNoMapa(ctx: Ctx, visual: Visual): void {
  const aviso = visual.aviso;
  if (aviso === null || visual.agora >= aviso.ate) return;
  toast(ctx, AREA_MAPA.x + 8, AREA_MAPA.y + AREA_MAPA.h - 32, AREA_MAPA.w - 16, aviso.variante, aviso.icone, aviso.texto);
}

/** Moldura vermelha fixa por 1 s quando o alarme toca (sem piscar). */
export function molduraDeAlarme(ctx: Ctx, visual: Visual): void {
  if (visual.agora < visual.alarmeAte) rectS(ctx, AREA_MAPA.x, AREA_MAPA.y, AREA_MAPA.w, AREA_MAPA.h, C.danger, 2);
}

const veu = (ctx: Ctx): void => rectF(ctx, AREA_MAPA.x + 1, AREA_MAPA.y + 1, AREA_MAPA.w - 2, AREA_MAPA.h - 2, 'rgba(10,17,26,0.8)');

/** Fase concluída: estrelas (uma a cada 120 ms), trocas, mínimo e alerta. */
export function vitoria(ctx: Ctx, estado: Estado, visual: Visual): RegiaoClicavel[] {
  const { fase } = estado;
  veu(ctx);
  panel(ctx, 34, 98, 338, 212, {
    v: 'ok',
    title: `FASE ${fase.id} // BREACHED`,
    meta: `SETOR ${numeroDoSetor(fase.id)} · ${fase.setor.toUpperCase()}`,
  });
  TX(ctx, '> ACCESS GRANTED', 203, 132, { size: 18, bold: true, color: C.ok, align: 'center' }, 0.15);
  const decorrido = visual.agora - visual.vitoriaEm;
  for (let i = 0; i < 3; i++) {
    const apareceu = decorrido >= (i + 1) * 120;
    estrela(ctx, 171 + i * 32, 162, 13, apareceu && i < estado.estrelas);
  }
  T(ctx, `${estado.estrelas} de 3 estrelas`, 203, 186, { size: 11, color: C.dim, align: 'center' });
  ln(ctx, [[48, 198], [358, 198]], C.border, 1, [2, 3]);
  const numeros: [string, string][] = [
    ['TROCAS', String(estado.trocas)],
    ['MÍNIMO', String(fase.minimo)],
    ['ALERTA', `${estado.alerta}/${limiteAlerta(fase)}`],
  ];
  numeros.forEach(([rotulo, valor], i) => {
    const cx = 103 + i * 100;
    T(ctx, rotulo, cx, 212, { size: 11, color: C.dim, align: 'center' });
    T(ctx, valor, cx, 230, { size: 16, bold: true, align: 'center' });
  });
  const extras = estado.trocas - fase.minimo + estado.erros;
  if (extras <= 0) {
    T(ctx, '✓ SOLUÇÃO ÓTIMA · trocas = mínimo', 203, 252, { size: 11, bold: true, color: C.ok, align: 'center' });
  } else {
    T(ctx, `${extras} acima do mínimo (trocas extras + erros)`, 203, 252, { size: 11, color: C.dim, align: 'center' });
  }
  const proxima = { x: 48, y: 270, w: 178, h: 28 };
  const repetir = { x: 234, y: 270, w: 124, h: 28 };
  button(ctx, proxima.x, proxima.y, proxima.w, proxima.h, visual.ultimaFase ? 'RELATÓRIO FINAL' : 'PRÓXIMA FASE', 'confirm', { key: 'Enter' });
  button(ctx, repetir.x, repetir.y, repetir.w, repetir.h, 'REPETIR', 'default', { key: 'R' });
  return [
    { r: proxima, acao: { tipo: 'confirmar' } },
    { r: repetir, acao: { tipo: 'reiniciar' } },
  ];
}

export function pausa(ctx: Ctx): RegiaoClicavel[] {
  veu(ctx);
  panel(ctx, 54, 128, 298, 152, { v: 'focus', title: 'PAUSA // SESSION HOLD' });
  T(ctx, '> conexão suspensa', 203, 166, { size: 14, bold: true, color: C.term, align: 'center' });
  T(ctx, 'O sistema aguarda seu próximo comando.', 203, 186, { size: 11, color: C.dim, align: 'center' });
  const continuar = { x: 70, y: 206, w: 266, h: 26 };
  const reiniciar = { x: 70, y: 238, w: 128, h: 26 };
  const menu = { x: 208, y: 238, w: 128, h: 26 };
  button(ctx, continuar.x, continuar.y, continuar.w, continuar.h, 'CONTINUAR', 'confirm', { key: 'Esc' });
  button(ctx, reiniciar.x, reiniciar.y, reiniciar.w, reiniciar.h, 'REINICIAR', 'default', { key: 'R' });
  button(ctx, menu.x, menu.y, menu.w, menu.h, 'MENU', 'default', { key: 'Enter' });
  return [
    { r: continuar, acao: { tipo: 'pausar' } },
    { r: reiniciar, acao: { tipo: 'reiniciar' } },
    { r: menu, acao: { tipo: 'confirmar' } },
  ];
}
