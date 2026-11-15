import { circuitoEmFoco } from '../jogo/regras';
import type { Circuito, Estado } from '../jogo/tipos';
import { avaliar } from '../logica/avaliar';
import { formatar } from '../logica/formatar';
import { paraBit, type Bit, type Formula, type Valoracao } from '../logica/tipos';
import { circulo, contornar, escrever, escreverParagrafo, linha, preencher, type Ctx } from './desenho';
import { PAINEL, type Retangulo } from './layout';
import { CORES } from './tema';

// Painel do circuito: o destaque da tela. Desenha a árvore sintática da fórmula como um
// circuito — entradas à esquerda, portas lógicas no meio, lâmpada de saída à direita —
// e mostra o valor de cada porta na valoração atual (recalculado de dentro para fora).

const MARGEM = 10;
const ENTRADA = { w: 30, h: 20 };
const PORTA = { w: 48, h: 22 };
const RAIO_LAMPADA = 9;
const ALTURA_DA_FOLHA = 32;

/** Nó do circuito já posicionado na tela. */
interface NoDesenhado {
  readonly formula: Formula;
  readonly valor: Bit;
  readonly x: number; // borda esquerda
  readonly y: number; // centro vertical
  readonly w: number;
  readonly filhos: readonly NoDesenhado[];
}

/** Altura da árvore: 0 para proposição; cada porta lógica soma 1. */
function altura(f: Formula): number {
  if (f.tipo === 'VAR') return 0;
  if (f.tipo === 'NOT') return 1 + altura(f.a);
  return 1 + Math.max(altura(f.a), altura(f.b));
}

/**
 * Posiciona a árvore: cada nó fica na coluna da sua altura (entradas na coluna 0),
 * as folhas são empilhadas de cima para baixo e cada porta fica na média dos filhos.
 */
function posicionar(raiz: Formula, v: Valoracao, area: Retangulo): NoDesenhado {
  const niveis = altura(raiz);
  const sobra = area.w - ENTRADA.w - niveis * PORTA.w - RAIO_LAMPADA * 2;
  const vao = Math.min(30, sobra / (niveis + 1));
  let proximaFolha = 0;
  const folhas = contarFolhas(raiz);
  const topo = area.y + (area.h - folhas * ALTURA_DA_FOLHA) / 2 + ALTURA_DA_FOLHA / 2;

  const visitar = (f: Formula): NoDesenhado => {
    const valor = paraBit(avaliar(f, v));
    if (f.tipo === 'VAR') {
      const y = topo + proximaFolha++ * ALTURA_DA_FOLHA;
      return { formula: f, valor, x: area.x, y, w: ENTRADA.w, filhos: [] };
    }
    const filhos = f.tipo === 'NOT' ? [visitar(f.a)] : [visitar(f.a), visitar(f.b)];
    const y = filhos.reduce((soma, filho) => soma + filho.y, 0) / filhos.length;
    const x = area.x + ENTRADA.w + vao + (altura(f) - 1) * (PORTA.w + vao);
    return { formula: f, valor, x, y, w: PORTA.w, filhos };
  };
  return visitar(raiz);
}

function contarFolhas(f: Formula): number {
  if (f.tipo === 'VAR') return 1;
  if (f.tipo === 'NOT') return contarFolhas(f.a);
  return contarFolhas(f.a) + contarFolhas(f.b);
}

const corDoValor = (valor: Bit): string => (valor === 1 ? CORES.um : CORES.zero);

/** Fio em "degrau" entre a saída de um nó e a entrada do próximo; ciano e mais grosso se leva 1. */
function fio(ctx: Ctx, deX: number, deY: number, ateX: number, ateY: number, valor: Bit): void {
  const meio = ateX - 8;
  linha(ctx, [[deX, deY], [meio, deY], [meio, ateY], [ateX, ateY]], corDoValor(valor), valor === 1 ? 2 : 1);
}

function desenharNo(ctx: Ctx, no: NoDesenhado): void {
  // Primeiro os fios e os filhos (de dentro para fora), depois a própria porta.
  no.filhos.forEach((filho, i) => {
    const entradaY = no.filhos.length === 1 ? no.y : no.y + (i === 0 ? -6 : 6);
    fio(ctx, filho.x + filho.w, filho.y, no.x, entradaY, filho.valor);
    desenharNo(ctx, filho);
  });

  const ehEntrada = no.formula.tipo === 'VAR';
  const h = ehEntrada ? ENTRADA.h : PORTA.h;
  const caixa = { x: no.x, y: no.y - h / 2, w: no.w, h };
  // Aceso (1) = preenchido em ciano; apagado (0) = só contorno. O dígito aparece sempre.
  if (no.valor === 1) {
    preencher(ctx, caixa, CORES.um);
  } else {
    preencher(ctx, caixa, CORES.painel);
    contornar(ctx, caixa, CORES.zero, 1);
  }
  const rotulo = no.formula.tipo === 'VAR' ? `${no.formula.nome}=${no.valor}` : `${no.formula.tipo}·${no.valor}`;
  escrever(ctx, rotulo, no.x + no.w / 2, no.y + 0.5, {
    cor: no.valor === 1 ? CORES.fundoTela : CORES.texto,
    alinhar: 'center',
    negrito: !ehEntrada,
  });
}

/** O que o elemento precisa e como está agora, em palavras. */
function situacaoDoCircuito(circuito: Circuito, saida: Bit): { texto: string; cor: string } {
  if (circuito.tipo === 'laser') {
    return saida === 1
      ? { texto: 'SAÍDA = 1 · LASER LIGADO', cor: CORES.perigo }
      : { texto: 'SAÍDA = 0 · LASER DESLIGADO', cor: CORES.sucesso };
  }
  const nome = circuito.tipo === 'ponte' ? 'PONTE' : 'PORTA';
  const [aberta, fechada] = circuito.tipo === 'ponte' ? ['ESTENDIDA', 'RECOLHIDA'] : ['ABERTA', 'TRANCADA'];
  return saida === 1
    ? { texto: `SAÍDA = 1 · ${nome} ${aberta}`, cor: CORES.sucesso }
    : { texto: `SAÍDA = 0 · ${nome} ${fechada}`, cor: CORES.perigo };
}

/**
 * Desenha o painel com o circuito do elemento mais próximo do jogador.
 * Devolve o y logo abaixo do que foi desenhado (o Scanner e a dica usam o espaço restante).
 */
export function desenharPainel(ctx: Ctx, estado: Estado): number {
  preencher(ctx, PAINEL, CORES.painel);
  contornar(ctx, PAINEL, CORES.bordaPainel);
  const x = PAINEL.x + MARGEM;
  const largura = PAINEL.w - MARGEM * 2;

  const circuito = circuitoEmFoco(estado);
  if (circuito === undefined) return PAINEL.y + MARGEM;

  const precisa = circuito.tipo === 'laser' ? 0 : 1;
  escrever(ctx, `${circuito.tipo.toUpperCase()} · precisa dar ${precisa}`, x, PAINEL.y + 14, {
    cor: CORES.textoSecundario,
  });
  escrever(ctx, formatar(circuito.formula), x, PAINEL.y + 32, { tamanho: 14, negrito: true });

  const folhas = contarFolhas(circuito.formula);
  const area: Retangulo = { x, y: PAINEL.y + 46, w: largura, h: Math.max(64, folhas * ALTURA_DA_FOLHA + 8) };
  const raiz = posicionar(circuito.formula, estado.valoracao, area);
  desenharNo(ctx, raiz);

  // Lâmpada de saída: verde quando o resultado é o que o elemento precisa; vermelha quando não.
  const lampadaX = area.x + area.w - RAIO_LAMPADA;
  const certo = raiz.valor === precisa;
  linha(ctx, [[raiz.x + raiz.w, raiz.y], [lampadaX - RAIO_LAMPADA, raiz.y]], corDoValor(raiz.valor), raiz.valor === 1 ? 2 : 1);
  const corDaLampada = certo ? CORES.sucesso : CORES.perigo;
  // Acesa (saída 1) = preenchida; apagada (saída 0) = só contorno.
  circulo(ctx, lampadaX, raiz.y, RAIO_LAMPADA, raiz.valor === 1 ? corDaLampada : CORES.painel, corDaLampada, 2);
  escrever(ctx, String(raiz.valor), lampadaX, raiz.y + 0.5, {
    cor: raiz.valor === 1 ? CORES.fundoTela : corDaLampada,
    alinhar: 'center',
    negrito: true,
  });

  const situacao = situacaoDoCircuito(circuito, raiz.valor);
  const ySituacao = area.y + area.h + 10;
  escrever(ctx, situacao.texto, x, ySituacao, { cor: situacao.cor, negrito: true });
  return ySituacao + 14;
}

/** Dica da fase, no espaço que sobra do painel. */
export function desenharDica(ctx: Ctx, estado: Estado, y: number): void {
  if (estado.fase.dica === '') return;
  const x = PAINEL.x + MARGEM;
  linha(ctx, [[x, y], [PAINEL.x + PAINEL.w - MARGEM, y]], CORES.bordaPainel);
  escreverParagrafo(ctx, estado.fase.dica, x, y + 14, PAINEL.w - MARGEM * 2, { cor: CORES.textoSecundario });
}
