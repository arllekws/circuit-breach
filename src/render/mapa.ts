import { interruptorAoAlcance, mesmaPosicao, portaAberta, terminalAoAlcance } from '../jogo/regras';
import type { Circuito, Estado, Fase, Posicao } from '../jogo/tipos';
import { variaveis } from '../logica/tabelaVerdade';
import { FX } from './efeitos';
import { origemDoMapa, type Visual } from './layout';
import { bracket, caminho, ln, rectF, rectS, T, val, type Ctx } from './primitivas';
import { ANIMACAO_MS, C, CELULA } from './tema';

// Mapa visto de cima. Lê o estado e desenha; NÃO decide regra (pergunta ao jogo: portaAberta…).

/** Progresso (0 a 1) da transição de um elemento que acabou de mudar de estado. */
export function progressoDaMudanca(visual: Visual, id: string): number {
  const inicio = visual.mudancas.get(id);
  return inicio === undefined ? 1 : Math.min(1, Math.max(0, (visual.agora - inicio) / ANIMACAO_MS));
}

/** Vão sob uma ponte recolhida: fundo escuro com hachura diagonal. */
function vao(ctx: Ctx, x: number, y: number): void {
  rectF(ctx, x, y, CELULA, CELULA, C.bg);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, CELULA, CELULA);
  ctx.clip();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let i = -CELULA; i < CELULA; i += 8) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + CELULA);
    ctx.lineTo(x + i + CELULA, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Primeira coluna à direita do emissor que é parede (o feixe vai até ela). */
function fimDoFeixe(fase: Fase, laser: Circuito): number {
  let x = laser.em.x + 1;
  while (x < fase.largura && fase.paredes[laser.em.y]?.[x] === false) x++;
  return x;
}

/** Altura do mapa desenhado, em px (para o modo invasão usar os vazios). */
export function desenharMapa(ctx: Ctx, estado: Estado, visual: Visual): { y: number; h: number } {
  const { fase } = estado;
  const o = origemDoMapa(fase);
  const cel = (p: Posicao): [number, number] => [o.x + p.x * CELULA, o.y + p.y * CELULA];
  const centro = (p: Posicao): [number, number] => [o.x + p.x * CELULA + 15, o.y + p.y * CELULA + 15];

  // Chão, paredes e o vão sob as pontes.
  const pontes = fase.portas.filter((c) => c.tipo === 'ponte');
  for (let y = 0; y < fase.altura; y++) {
    for (let x = 0; x < fase.largura; x++) {
      const px = o.x + x * CELULA;
      const py = o.y + y * CELULA;
      if (fase.paredes[y]?.[x] === true) rectF(ctx, px, py, CELULA, CELULA, C.wall);
      else if (pontes.some((p) => p.em.x === x && p.em.y === y)) vao(ctx, px, py);
      else {
        rectF(ctx, px, py, CELULA, CELULA, C.map);
        rectS(ctx, px, py, CELULA, CELULA, C.grid);
      }
    }
  }

  // Ligações: cada entrada (interruptor, placa, terminal) até os circuitos que ela alimenta.
  const entradas = [...fase.interruptores, ...fase.placas, ...fase.desafios];
  for (const circuito of [...fase.portas, ...fase.lasers]) {
    const usadas = variaveis(circuito.formula);
    for (const e of entradas) {
      if (!usadas.includes(e.nome)) continue;
      const um = estado.valoracao[e.nome] === 1;
      ln(ctx, [centro(e.em), centro(circuito.em)], um ? C.one : C.zero, um ? 1.5 : 1, [3, 3], um && FX.ligado ? -FX.t * 12 : 0);
    }
  }

  // Saída: tracejado verde com chevron.
  {
    const [x, y] = cel(fase.saida);
    const [cx, cy] = centro(fase.saida);
    rectS(ctx, x + 3, y + 3, 24, 24, C.ok, 2, [4, 3]);
    ln(ctx, [[cx - 6, cy + 3], [cx, cy - 3], [cx + 6, cy + 3]], C.ok, 2);
  }

  // Placas de pressão: dois quadrados concêntricos + chip com o valor.
  for (const placa of fase.placas) {
    const [x, y] = cel(placa.em);
    rectS(ctx, x + 3, y + 3, 24, 24, C.zero);
    rectS(ctx, x + 5, y + 5, 20, 20, C.zero);
    val(ctx, x + 7, y + 7, estado.valoracao[placa.nome] ?? 0, 16, 11);
  }

  // Portas e pontes. A transição de abrir dura ANIMACAO_MS.
  for (const porta of fase.portas) {
    const [x, y] = cel(porta.em);
    const aberta = portaAberta(estado, porta);
    const p = progressoDaMudanca(visual, porta.id);
    if (porta.tipo === 'ponte') {
      if (aberta) {
        // Estendida: tábuas verdes, crescendo da esquerda para a direita.
        const w = Math.max(6, Math.round(CELULA * p));
        rectF(ctx, x, y + 5, w, 20, C.map);
        rectS(ctx, x, y + 5, w, 20, C.ok, 2);
        for (let xx = x + 6; xx < x + w - 2; xx += 6) rectF(ctx, xx, y + 8, 1, 14, C.ok);
      } else {
        rectS(ctx, x + 1, y + 5, CELULA - 2, 20, C.zero, 1, [3, 3]);
      }
      val(ctx, x + 7, y + 7, aberta ? 1 : 0, 16, 11);
      continue;
    }
    rectF(ctx, x, y, CELULA, CELULA, C.map);
    if (aberta) {
      // Duas folhas verdes que se afastam do centro.
      const d = Math.round(11 * p);
      rectF(ctx, x + 13 - d, y + 2, 4, 26, C.ok);
      rectF(ctx, x + 13 + d, y + 2, 4, 26, C.ok);
    } else {
      // Trancada: moldura vermelha com a barra cruzando.
      rectS(ctx, x + 2, y + 2, 26, 26, C.danger, 2);
      rectF(ctx, x + 4, y + 13, 22, 4, C.danger);
    }
    val(ctx, x + 7, y + 7, aberta ? 1 : 0, 16, 11);
  }

  // Lasers: diamante vermelho. Em jogo o circuito do laser está sempre em 0 (se der 1, o
  // alarme reinicia a fase): o feixe fica pontilhado. Durante o alarme, o feixe aparece cheio.
  const disparou = visual.agora < visual.alarmeAte;
  for (const laser of fase.lasers) {
    const [cx, cy] = centro(laser.em);
    const x2 = o.x + fimDoFeixe(fase, laser) * CELULA;
    if (disparou) {
      rectF(ctx, cx + 10, cy - 1, x2 - cx - 10, 2, C.danger);
      for (let xx = o.x + (laser.em.x + 1) * CELULA; xx < x2; xx += CELULA) rectF(ctx, xx, cy - 4, 1, 8, C.danger);
    } else {
      ln(ctx, [[cx + 10, cy], [x2, cy]], C.zero, 1, [2, 4]);
    }
    caminho(ctx, [[cx, cy - 11], [cx + 11, cy], [cx, cy + 11], [cx - 11, cy]]);
    ctx.fillStyle = disparou ? C.danger : C.map;
    ctx.fill();
    ctx.strokeStyle = C.danger;
    ctx.lineWidth = 2;
    ctx.stroke();
    T(ctx, disparou ? '1' : '0', cx, cy + 0.5, { size: 11, bold: true, color: disparou ? C.ink : C.text, align: 'center' });
  }

  // Interruptores: 24 × 24 com nome e dígito; cheio se 1.
  for (const interruptor of fase.interruptores) {
    const [x, y] = cel(interruptor.em);
    const v = estado.valoracao[interruptor.nome] ?? 0;
    if (v === 1) rectF(ctx, x + 3, y + 3, 24, 24, C.one);
    else {
      rectF(ctx, x + 3, y + 3, 24, 24, C.map);
      rectS(ctx, x + 3, y + 3, 24, 24, C.zero, 2);
    }
    const cor = v === 1 ? C.ink : C.text;
    T(ctx, interruptor.nome, x + 15, y + 10, { size: 11, bold: true, color: cor, align: 'center' });
    T(ctx, String(v), x + 15, y + 21, { size: 12, bold: true, color: cor, align: 'center' });
  }

  // Terminais de desafio: monitor com a proposição e o valor (resolvido = 1, cheio).
  for (const terminal of fase.desafios) {
    const [x, y] = cel(terminal.em);
    const v = estado.valoracao[terminal.nome] ?? 0;
    rectF(ctx, x + 4, y + 4, 22, 17, v === 1 ? C.one : C.panel);
    rectS(ctx, x + 4, y + 4, 22, 17, v === 1 ? C.one : C.text, 1.5);
    T(ctx, `${terminal.nome}${v}`, x + 15, y + 13, { size: 11, bold: true, color: v === 1 ? C.ink : C.text, align: 'center' });
    rectF(ctx, x + 13, y + 21, 4, 3, C.text);
    rectF(ctx, x + 9, y + 24, 12, 2, C.text);
  }

  // Caixas.
  for (const caixa of estado.caixas) {
    const [x, y] = cel(caixa);
    rectF(ctx, x + 4, y + 4, 22, 22, C.panel);
    rectS(ctx, x + 4, y + 4, 22, 22, C.text, 2);
    ln(ctx, [[x + 8, y + 8], [x + 22, y + 22]], C.text);
    ln(ctx, [[x + 22, y + 8], [x + 8, y + 22]], C.text);
  }

  // Foco: o que a tecla E vai acionar ganha cantoneiras âmbar.
  if (estado.situacao === 'jogando') {
    const alvo =
      interruptorAoAlcance(estado)?.em ??
      ((): Posicao | undefined => {
        const t = terminalAoAlcance(estado);
        return t !== undefined && estado.valoracao[t.nome] !== 1 ? t.em : undefined;
      })();
    if (alvo !== undefined && !mesmaPosicao(alvo, estado.jogador)) {
      const [x, y] = cel(alvo);
      bracket(ctx, x, y, CELULA, CELULA);
    }
  }

  // O hacker: círculo âmbar com o ponto de direção; anel vermelho quando atingido.
  {
    const cx = o.x + visual.jogador.x * CELULA + 15;
    const cy = o.y + visual.jogador.y * CELULA + 15;
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    const [dx, dy] = { direita: [1, 0], esquerda: [-1, 0], cima: [0, -1], baixo: [0, 1] }[estado.direcao] as [number, number];
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(cx + dx * 4.5, cy + dy * 4.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (disparou) {
      ctx.strokeStyle = C.danger;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return { y: o.y, h: fase.altura * CELULA };
}
