import { circuitoEmFoco, limiteAlerta, estrelasPara } from '../jogo/regras';
import { tabelaDoScanner } from '../jogo/scanner';
import { PASSOS, passoAtual } from '../jogo/tutorial';
import type { Circuito, Estado, Fase } from '../jogo/tipos';
import { avaliarPassoAPasso } from '../logica/avaliar';
import { classificar } from '../logica/classificar';
import { formatar } from '../logica/formatar';
import { variaveis } from '../logica/tabelaVerdade';
import { altura, arvoreAvaliada, folhas, type NoExibido, type Operador } from './arvore';
import { fx } from './efeitos';
import { avisoNoMapa, hud, molduraDeAlarme, pausa, vitoria } from './hud';
import { AREA_MAPA, origemDoMapa, PAINEL, type RegiaoClicavel, type Retangulo, type Visual } from './layout';
import { desenharMapa } from './mapa';
import {
  bracket,
  callout,
  circuit,
  footer,
  keyHint,
  ln,
  OPS,
  panel,
  rectF,
  rectS,
  resultBlock,
  T,
  tab,
  truth,
  wrapLines,
  type Ctx,
  type ItemDoRodape,
  type Ponto,
} from './primitivas';
import { C, CELULA } from './tema';

// Tela de fase: HUD, mapa à esquerda e o painel do circuito à direita (o destaque da tela).

const RODAPE_DA_FASE: readonly ItemDoRodape[] = [
  [['←↑↓→', 'WASD'], 'mover'],
  ['E', 'interagir'],
  ['Q', 'scanner'],
  ['R', 'reiniciar'],
  ['Esc', 'pausar'],
  ['M', 'efeitos'],
];

const LETRA: Readonly<Record<Circuito['tipo'], string>> = { porta: 'D', ponte: 'B', laser: 'L' };

/** Rótulo do elemento no painel, ex.: "PORTA D1", "PONTE B1", "LASER L1" (numerados por tipo). */
export function rotuloDoCircuito(c: Circuito, fase: Fase): string {
  const mesmos = [...fase.portas, ...fase.lasers].filter((outro) => outro.tipo === c.tipo);
  return `${c.tipo.toUpperCase()} ${LETRA[c.tipo]}${mesmos.indexOf(c) + 1}`;
}

const SIGNIFICADO: Readonly<Record<Exclude<Operador, 'unk'>, string>> = {
  not: 'inverte a entrada',
  and: 'só dá 1 com as duas em 1',
  or: 'dá 1 se ao menos uma for 1',
  xor: 'dá 1 se forem diferentes',
  imp: 'só dá 0 quando 1 → 0',
  bic: 'dá 1 se forem iguais',
};

/** Operadores que aparecem na árvore, sem repetir, de dentro para fora. */
function operadores(no: NoExibido, lista: Exclude<Operador, 'unk'>[] = []): Exclude<Operador, 'unk'>[] {
  if ('in' in no) return lista;
  no.a.forEach((filho) => operadores(filho, lista));
  if (no.op !== 'unk' && !lista.includes(no.op)) lista.push(no.op);
  return lista;
}

/** Texto de estado e de "quanto falta" para o bloco de resultado. */
function resultadoDoCircuito(estado: Estado, circuito: Circuito, raiz: NoExibido) {
  const meta: 0 | 1 = circuito.tipo === 'laser' ? 0 : 1;
  const v = raiz.v === '?' ? 0 : raiz.v;
  const certo = v === meta;
  const nomes: Record<Circuito['tipo'], readonly [string, string]> = {
    porta: ['PORTA ABERTA', 'PORTA TRANCADA'],
    ponte: ['PONTE ESTENDIDA', 'PONTE RECOLHIDA'],
    laser: ['LASER DESLIGADO', 'LASER LIGADO'],
  };
  const [bom, ruim] = nomes[circuito.tipo];
  const classe = classificar(circuito.formula);
  let falta: string;
  if (classe === 'tautologia') falta = 'tautologia: dá 1 em toda valoração';
  else if (classe === 'contradicao') falta = 'contradição: nunca dá 1';
  else if (certo) falta = circuito.tipo === 'laser' ? 'seguro · mantenha em 0' : 'meta atingida · caminho livre';
  else if ('in' in raiz) {
    const terminal = estado.fase.desafios.some((d) => d.nome === raiz.in);
    falta = terminal ? `resolva o terminal ${raiz.in}` : `entrada ${raiz.in} = ${raiz.v}`;
  } else if (raiz.op === 'not') falta = `NOT: entrada em ${raiz.a[0]?.v ?? '?'}`;
  else {
    const emUm = raiz.a.filter((f) => f.v === 1).length;
    falta = `${OPS[raiz.op][1]}: ${emUm} de ${raiz.a.length} entradas em 1`;
  }
  return { v: raiz.v, meta, estado: certo ? bom : ruim, falta };
}

/** Lista TREINAMENTO do tutorial (✓ feito, ▸ atual, · pendente). */
function listaDoTutorial(ctx: Ctx, x: number, y: number, feitos: readonly boolean[]): void {
  const passo = passoAtual(feitos);
  tab(ctx, x, y, 'TREINAMENTO', 'focus');
  T(ctx, passo > PASSOS.length ? 'CONCLUÍDO' : `PASSO ${passo}/${PASSOS.length}`, 664, y + 8.5, {
    size: 11,
    bold: true,
    color: passo > PASSOS.length ? C.ok : C.amber,
    align: 'right',
  });
  PASSOS.forEach((texto, i) => {
    const yy = y + 32 + i * 20;
    const feito = feitos[i] === true;
    const atual = i + 1 === passo;
    T(ctx, feito ? '✓' : atual ? '▸' : '·', x + 4, yy, { size: 12, bold: true, color: feito ? C.ok : atual ? C.amber : C.dim });
    T(ctx, `${i + 1}  ${texto}`, x + 20, yy, { size: 12, bold: atual, color: atual ? C.text : C.dim });
  });
}

/** Área de baixo do painel: dica + cartões dos operadores do circuito. */
function dica(ctx: Ctx, estado: Estado, ops: readonly Exclude<Operador, 'unk'>[], y: number): void {
  const x = PAINEL.x + 8;
  const fim = PAINEL.y + PAINEL.h - 8;
  tab(ctx, x, y, 'DICA');
  let yy = y + 30;
  // Cabem a dica e os cartões? Senão, a dica vai em 11 px e os cartões que não couberem saem.
  let tamanho = 12;
  let lh = 16;
  let linhas = wrapLines(ctx, estado.fase.dica, 246, tamanho);
  const espacoDoScanner = 22;
  if (yy + linhas.length * lh + 8 + ops.length * 26 + espacoDoScanner > fim) {
    tamanho = 11;
    lh = 14;
    linhas = wrapLines(ctx, estado.fase.dica, 246, tamanho);
  }
  linhas.forEach((l) => {
    T(ctx, l, x, yy, { size: tamanho });
    yy += lh;
  });
  yy += 8;
  for (const op of ops) {
    if (yy + 10 > fim - espacoDoScanner) break;
    rectF(ctx, x, yy - 10, 20, 20, C.map);
    rectS(ctx, x, yy - 10, 20, 20, C.border);
    T(ctx, OPS[op][0], x + 10, yy + 0.5, { size: 14, bold: true, align: 'center' });
    T(ctx, `${OPS[op][1]}: ${SIGNIFICADO[op]}`, x + 28, yy + 0.5, { size: 11 });
    yy += 26;
  }
  if (yy - 10 <= fim - 18) keyHint(ctx, x, fim - 18, 'Q', 'abrir Scanner · +2 alerta', C.text);
}

/** Painel do circuito do elemento mais próximo. Devolve onde ficaram entradas e resultado. */
function painelDoCircuito(ctx: Ctx, estado: Estado, visual: Visual): { entrada: Retangulo; resultado: Retangulo; inferior: number } {
  const circuito = circuitoEmFoco(estado);
  const x = PAINEL.x + 8;
  const vazio = { entrada: { x: 0, y: 0, w: 0, h: 0 }, resultado: { x: 0, y: 0, w: 0, h: 0 }, inferior: 220 };
  if (circuito === undefined) {
    panel(ctx, PAINEL.x, PAINEL.y, PAINEL.w, PAINEL.h, { title: 'MÓDULO' });
    return vazio;
  }
  panel(ctx, PAINEL.x, PAINEL.y, PAINEL.w, PAINEL.h, {
    title: `MÓDULO · ${rotuloDoCircuito(circuito, estado.fase)}`,
    meta: circuito.tipo === 'laser' ? 'SEGURO COM 0' : 'ATIVA COM 1',
  });
  T(ctx, formatar(circuito.formula), PAINEL.x + 12, 66, { size: 18, bold: true });
  ln(ctx, [[x, 84], [PAINEL.x + PAINEL.w - 8, 84]], C.border, 1, [2, 3]);

  // A árvore se ajusta à largura do painel: portas mais estreitas se o circuito for fundo.
  const raiz = arvoreAvaliada(circuito.formula, estado.valoracao);
  const h = Math.max(1, altura(raiz));
  const gw = Math.min(92, Math.floor((246 - 48) / h) - 8);
  circuit(ctx, PAINEL.x + 12, 92, raiz, { gw });
  const yResultado = Math.max(170, 92 + folhas(raiz) * 24 + 4);
  const resultado = resultadoDoCircuito(estado, circuito, raiz);
  resultBlock(ctx, x, yResultado, 250, resultado);

  const inferior = yResultado + 50;
  const escaneado = estado.escaneados.includes(circuito.id);
  if (escaneado) {
    const tabela = tabelaDoScanner(circuito, estado.valoracao);
    const vars = tabela.colunas.slice(0, tabela.proposicoes);
    tab(ctx, x, inferior, 'SCANNER · TABELA-VERDADE');
    const alvos = tabela.linhas.filter((l) => l.alvo).length;
    const tutorial = visual.tutorial !== null && passoAtual(visual.tutorial) <= PASSOS.length;
    T(ctx, tutorial ? `PASSO ${passoAtual(visual.tutorial ?? [])}/6` : `${alvos} ${alvos === 1 ? 'alvo' : 'alvos'}`, 664, inferior + 8.5, {
      size: 11,
      color: tutorial ? C.amber : C.dim,
      bold: tutorial,
      align: 'right',
    });
    const meta = circuito.tipo === 'laser' ? 0 : 1;
    truth(ctx, x, inferior + 28, {
      vars,
      goal: meta,
      cur: tabela.linhas.findIndex((l) => l.atual),
      rows: tabela.linhas.map((l) => [l.valores.slice(0, tabela.proposicoes) as (0 | 1)[], l.valores[l.valores.length - 1] as 0 | 1]),
      rh: tabela.linhas.length > 8 ? 9 : 14,
    });
  } else if (visual.tutorial !== null) {
    listaDoTutorial(ctx, x, inferior, visual.tutorial);
  } else {
    dica(ctx, estado, operadores(raiz), inferior);
  }
  return {
    entrada: { x: PAINEL.x + 10, y: 90, w: 44, h: 24 },
    resultado: { x: x - 2, y: yResultado - 2, w: 254, h: 46 },
    inferior,
  };
}

/** Linhas do log do modo invasão, tiradas do circuito em foco. */
function logDoCircuito(estado: Estado): [string, string?][] {
  const circuito = circuitoEmFoco(estado);
  if (circuito === undefined) return [['> aguardando entrada ...']];
  const nomes = variaveis(circuito.formula);
  const passos = avaliarPassoAPasso(circuito.formula, estado.valoracao);
  const meta = circuito.tipo === 'laser' ? 0 : 1;
  const linhas: [string, string?][] = [
    [`> scan ${rotuloDoCircuito(circuito, estado.fase)} :: ${formatar(circuito.formula)}`],
    [`  in   ${nomes.map((n) => `${n}=${estado.valoracao[n]}`).join('  ')}`],
  ];
  passos.forEach((p, i) => {
    const ultimo = i === passos.length - 1;
    const certo = p.valor === meta;
    linhas.push([`  ${formatar(p.formula)} = ${p.valor}${ultimo ? (certo ? '   ✓' : '   ✕') : ''}`, ultimo ? (certo ? C.ok : C.danger) : undefined]);
  });
  linhas.push([
    `> alerta ${estado.alerta}/${limiteAlerta(estado.fase)} · ${estrelasPara(estado.trocas, estado.fase.minimo, estado.erros)} estrelas possíveis`,
  ]);
  linhas.push(['> aguardando entrada ...']);
  return linhas;
}

/** Balões do tutorial: apontam para o que importa no passo atual. Não pausam o jogo. */
function baloesDoTutorial(ctx: Ctx, estado: Estado, visual: Visual, alvos: { entrada: Retangulo; resultado: Retangulo }): void {
  if (visual.tutorial === null || estado.situacao !== 'jogando') return;
  const passo = passoAtual(visual.tutorial);
  if (passo > PASSOS.length) return;
  const { fase } = estado;
  const o = origemDoMapa(fase);
  const celula = (p: { x: number; y: number }): Retangulo => ({ x: o.x + p.x * CELULA, y: o.y + p.y * CELULA, w: CELULA, h: CELULA });
  const primeiro = fase.interruptores[0];
  const textos: Record<number, { texto: string; alvo?: Retangulo; teclas?: ItemDoRodape }> = {
    1: { texto: `Ande até o interruptor ${primeiro?.nome ?? ''}. Ele é sólido: encoste nele.`, alvo: primeiro && celula(primeiro.em), teclas: [['←↑↓→', 'WASD'], 'mover'] },
    2: { texto: 'Encostado no interruptor, aperte E: o valor dele alterna entre 0 e 1.', alvo: primeiro && celula(primeiro.em), teclas: ['E', 'alternar'] },
    3: { texto: 'Valor 1 é sempre preenchido; 0 é só contorno. O mesmo valor chega à entrada do circuito.', alvo: alvos.entrada },
    4: { texto: 'Cada porta lógica mostra o próprio resultado. Troque o outro interruptor e veja o circuito mudar.', alvo: alvos.resultado },
    5: { texto: 'O Scanner mostra a tabela-verdade: a linha ◂ ALVO é a que abre a porta. Custa 2 de alerta.', teclas: ['Q', 'scanner'] },
    6: { texto: 'Quando o resultado der 1, a porta abre. Vá até a saída tracejada em verde.', alvo: celula(fase.saida) },
  };
  const balao = textos[passo];
  if (balao === undefined) return;
  // O balão fica na metade do mapa oposta ao hacker, para não cobri-lo.
  const w = 236;
  const linhas = wrapLines(ctx, balao.texto, w - 20, 12).length;
  const h = 32 + linhas * 16 + (balao.teclas !== undefined ? 22 : 0);
  const x = AREA_MAPA.x + 70;
  const emCima = estado.jogador.y >= fase.altura / 2;
  const y = emCima ? o.y + 8 : o.y + fase.altura * CELULA - h - 8;
  let de: Ponto | undefined;
  let ate: Ponto | undefined;
  if (balao.alvo !== undefined) {
    const a = balao.alvo;
    bracket(ctx, a.x, a.y, a.w, a.h);
    const naDireita = a.x > x + w;
    ate = [naDireita ? a.x : a.x + a.w / 2, naDireita ? a.y + a.h / 2 : emCima ? a.y : a.y + a.h];
    de = [naDireita ? x + w : Math.min(Math.max(ate[0], x + 10), x + w - 10), naDireita ? y + 20 : emCima ? y + h : y];
  }
  callout(ctx, x, y, w, {
    passo: `PASSO ${passo}/${PASSOS.length}`,
    texto: balao.texto,
    ...(balao.teclas !== undefined ? { teclas: balao.teclas } : {}),
    ...(de !== undefined && ate !== undefined ? { de, ate } : {}),
  });
}

/** Desenha a tela de fase inteira. Devolve as regiões clicáveis (vitória e pausa). */
export function telaDeFase(ctx: Ctx, estado: Estado, visual: Visual): RegiaoClicavel[] {
  hud(ctx, estado);
  rectF(ctx, AREA_MAPA.x, AREA_MAPA.y, AREA_MAPA.w, AREA_MAPA.h, C.bg);
  const o = origemDoMapa(estado.fase);
  const altDoMapa = estado.fase.altura * CELULA;
  const circuito = circuitoEmFoco(estado);
  const glifos = circuito === undefined ? undefined : [...variaveis(circuito.formula), ...formatar(circuito.formula).replace(/[\s()]/g, ''), '0', '1'];
  fx('vazioDoMapa', ctx, AREA_MAPA, o.y, altDoMapa, glifos);
  desenharMapa(ctx, estado, visual);
  fx('sobreOMapa', ctx, AREA_MAPA, o.y, altDoMapa, logDoCircuito(estado));
  rectS(ctx, AREA_MAPA.x, AREA_MAPA.y, AREA_MAPA.w, AREA_MAPA.h, C.border);
  molduraDeAlarme(ctx, visual);

  const alvos = painelDoCircuito(ctx, estado, visual);
  footer(ctx, RODAPE_DA_FASE);
  avisoNoMapa(ctx, visual);
  baloesDoTutorial(ctx, estado, visual, alvos);

  if (estado.situacao === 'vitoria') return vitoria(ctx, estado, visual);
  if (estado.situacao === 'pausado') return pausa(ctx);
  return [];
}
