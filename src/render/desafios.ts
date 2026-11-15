import { montarFormula, type Espelho, type EstadoDoDesafio, type Montagem } from '../jogo/desafios';
import type { Estado } from '../jogo/tipos';
import { avaliar } from '../logica/avaliar';
import { formatar } from '../logica/formatar';
import { valoracoes, variaveis } from '../logica/tabelaVerdade';
import { paraBit, type ConectivoBinario } from '../logica/tipos';
import { contornar, escrever, linha, preencher, type Ctx } from './desenho';
import { AREA_MAPA, PAINEL, type RegiaoClicavel, type Retangulo } from './layout';
import { CORES, fonte } from './tema';

// Telas dos desafios do Firewall. Cada função desenha o desafio aberto e devolve as regiões
// clicáveis (o mouse só transforma o clique na ação da região; a regra continua em jogo/).

/** A tela do desafio ocupa o lugar do mapa e do painel. */
const AREA: Retangulo = {
  x: AREA_MAPA.x,
  y: AREA_MAPA.y,
  w: PAINEL.x + PAINEL.w - AREA_MAPA.x,
  h: AREA_MAPA.h,
};
const MARGEM = 16;

const SIMBOLO: Readonly<Record<ConectivoBinario, string>> = { AND: '∧', OR: '∨', XOR: '⊕', IMP: '→', IFF: '↔' };

function moldura(ctx: Ctx, titulo: string, subtitulo: string): void {
  preencher(ctx, AREA, CORES.painel);
  contornar(ctx, AREA, CORES.bordaPainel);
  escrever(ctx, titulo, AREA.x + MARGEM, AREA.y + 20, { tamanho: 14, negrito: true });
  escrever(ctx, subtitulo, AREA.x + MARGEM, AREA.y + 42, { cor: CORES.textoSecundario });
  linha(ctx, [[AREA.x + MARGEM, AREA.y + 56], [AREA.x + AREA.w - MARGEM, AREA.y + 56]], CORES.bordaPainel);
}

function rodapeDoDesafio(ctx: Ctx, texto: string): void {
  escrever(ctx, texto, AREA.x + AREA.w / 2, AREA.y + AREA.h - 14, { cor: CORES.textoSecundario, alinhar: 'center' });
}

/** Caixa de escolha (porta lógica, cabo, botão): âmbar quando é a selecionada pelo jogador. */
function caixa(ctx: Ctx, r: Retangulo, selecionada: boolean): void {
  preencher(ctx, r, CORES.fundoMapa);
  contornar(ctx, r, selecionada ? CORES.jogador : CORES.zero, selecionada ? 2 : 1);
}

function desenharMontagem(
  ctx: Ctx,
  definicao: Montagem,
  aberto: Extract<EstadoDoDesafio, { tipo: 'montagem' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  moldura(ctx, 'FIREWALL · montagem de circuito', `Alvo: ${definicao.descricao}. Vale qualquer circuito equivalente.`);

  // --- o circuito com espaços, à esquerda ---
  const ESPACO = { w: 52, h: 28 };
  const partes = definicao.molde.split(/(\?\d+)/).filter((parte) => parte !== '');
  const textoDe = (parte: string): string => parte.replace(/NOT\s*/g, '¬').replace(/\s+/g, ' ');
  ctx.font = fonte(16, true);
  const larguras = partes.map((parte) => (parte.startsWith('?') ? ESPACO.w : ctx.measureText(textoDe(parte)).width));
  const esquerda: Retangulo = { x: AREA.x + MARGEM, y: AREA.y + 70, w: 400, h: 240 };
  let x = esquerda.x + (esquerda.w - larguras.reduce((soma, w) => soma + w, 0)) / 2;
  const yCircuito = esquerda.y + 40;
  partes.forEach((parte, i) => {
    const w = larguras[i] ?? 0;
    if (parte.startsWith('?')) {
      const espaco = Number(parte.slice(1)) - 1;
      const r: Retangulo = { x, y: yCircuito - ESPACO.h / 2, w: ESPACO.w - 4, h: ESPACO.h };
      const escolha = aberto.escolhas[espaco] ?? null;
      caixa(ctx, r, espaco === aberto.cursor);
      escrever(ctx, escolha ?? '?', r.x + r.w / 2, yCircuito + 0.5, {
        alinhar: 'center',
        negrito: true,
        cor: escolha === null ? CORES.textoSecundario : CORES.texto,
      });
      regioes.push({ r, acao: { tipo: 'selecionar', indice: espaco } });
    } else {
      escrever(ctx, textoDe(parte), x, yCircuito + 0.5, { tamanho: 16, negrito: true });
    }
    x += w;
  });

  // --- as portas lógicas disponíveis ---
  const yPortas = yCircuito + 62;
  escrever(ctx, `Porta para o espaço ${aberto.cursor + 1}:`, esquerda.x, yPortas - 26, { cor: CORES.textoSecundario });
  definicao.opcoes.forEach((opcao, i) => {
    const r: Retangulo = { x: esquerda.x + i * 76, y: yPortas - 14, w: 68, h: 28 };
    caixa(ctx, r, aberto.escolhas[aberto.cursor] === opcao);
    escrever(ctx, `${opcao} ${SIMBOLO[opcao]}`, r.x + r.w / 2, yPortas + 0.5, { alinhar: 'center', negrito: true });
    regioes.push({ r, acao: { tipo: 'escolherPorta', espaco: aberto.cursor, porta: opcao } });
  });

  // --- botão de teste ---
  const montada = montarFormula(definicao.molde, aberto.escolhas);
  const botao: Retangulo = { x: esquerda.x, y: yPortas + 40, w: 180, h: 30 };
  preencher(ctx, botao, CORES.fundoMapa);
  contornar(ctx, botao, montada === null ? CORES.zero : CORES.texto, montada === null ? 1 : 2);
  escrever(ctx, 'TESTAR CIRCUITO', botao.x + botao.w / 2, botao.y + botao.h / 2 + 0.5, {
    alinhar: 'center',
    negrito: true,
    cor: montada === null ? CORES.textoSecundario : CORES.texto,
  });
  regioes.push({ r: botao, acao: { tipo: 'confirmar' } });
  if (montada !== null) {
    escrever(ctx, `Seu circuito: ${formatar(montada)}`, esquerda.x, botao.y + botao.h + 22, {});
  }

  // --- tabela-verdade: alvo ao lado do circuito montado ---
  const nomes = variaveis(definicao.alvo);
  const xTabela = AREA.x + AREA.w - 216;
  const colunas = [...nomes, 'alvo', 'seu'];
  const xColuna = (i: number): number => xTabela + 14 + i * 34 + (i >= nomes.length ? 18 : 0);
  const yTabela = AREA.y + 84;
  escrever(ctx, 'TABELA-VERDADE', xTabela, yTabela - 12, { cor: CORES.textoSecundario });
  colunas.forEach((coluna, i) => escrever(ctx, coluna, xColuna(i), yTabela + 10, { alinhar: 'center', negrito: true }));
  linha(ctx, [[xTabela, yTabela + 20], [xTabela + 190, yTabela + 20]], CORES.zero);
  valoracoes(nomes).forEach((v, n) => {
    const y = yTabela + 34 + n * 18;
    nomes.forEach((nome, i) => escrever(ctx, String(v[nome]), xColuna(i), y, { alinhar: 'center' }));
    const alvo = paraBit(avaliar(definicao.alvo, v));
    escrever(ctx, String(alvo), xColuna(nomes.length), y, { alinhar: 'center', negrito: true });
    if (montada === null) {
      escrever(ctx, '?', xColuna(nomes.length + 1), y, { alinhar: 'center', cor: CORES.textoSecundario });
    } else {
      // Verde com "=" quando a linha bate com o alvo; vermelho com "≠" quando não bate.
      const seu = paraBit(avaliar(montada, v));
      const igual = seu === alvo;
      const cor = igual ? CORES.sucesso : CORES.perigo;
      escrever(ctx, String(seu), xColuna(nomes.length + 1), y, { alinhar: 'center', negrito: true, cor });
      escrever(ctx, igual ? '=' : '≠', xColuna(nomes.length + 1) + 20, y, { alinhar: 'center', cor });
    }
  });

  rodapeDoDesafio(ctx, '←→ escolhe o espaço · ↑↓ troca a porta · Enter testa · Esc volta ao mapa');
  return regioes;
}

function desenharEspelho(
  ctx: Ctx,
  definicao: Espelho,
  aberto: Extract<EstadoDoDesafio, { tipo: 'espelho' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  moldura(
    ctx,
    `FIREWALL ESPELHADO · rodada ${aberto.rodada + 1} de ${definicao.rodadas.length}`,
    'Só o cabo equivalente (mesma tabela-verdade) contorna o firewall. O outro dispara o alarme.',
  );
  const rodada = definicao.rodadas[aberto.rodada];
  if (rodada === undefined) return regioes;
  const cx = AREA.x + AREA.w / 2;

  // A fórmula do painel.
  escrever(ctx, 'PAINEL', cx, AREA.y + 82, { cor: CORES.textoSecundario, alinhar: 'center' });
  const painel: Retangulo = { x: cx - 150, y: AREA.y + 94, w: 300, h: 46 };
  preencher(ctx, painel, CORES.fundoMapa);
  contornar(ctx, painel, CORES.texto, 2);
  escrever(ctx, formatar(rodada.original), cx, painel.y + painel.h / 2 + 0.5, { tamanho: 20, negrito: true, alinhar: 'center' });

  // Os cabos.
  const largura = 250;
  const vao = 24;
  const total = rodada.cabos.length * largura + (rodada.cabos.length - 1) * vao;
  rodada.cabos.forEach((cabo, i) => {
    const r: Retangulo = { x: cx - total / 2 + i * (largura + vao), y: AREA.y + 190, w: largura, h: 60 };
    const selecionado = i === aberto.cursor;
    // Fio tracejado do painel até o cabo.
    linha(ctx, [[cx, painel.y + painel.h], [r.x + r.w / 2, r.y]], selecionado ? CORES.jogador : CORES.zero, 1, [3, 4]);
    caixa(ctx, r, selecionado);
    escrever(ctx, `${selecionado ? '> ' : ''}CABO ${i + 1}`, r.x + 10, r.y + 14, {
      cor: selecionado ? CORES.jogador : CORES.textoSecundario,
      negrito: selecionado,
    });
    escrever(ctx, formatar(cabo), r.x + r.w / 2, r.y + 38, { tamanho: 16, negrito: true, alinhar: 'center' });
    regioes.push({ r, acao: { tipo: 'escolherCabo', indice: i } });
  });

  rodapeDoDesafio(ctx, '←→ escolhe o cabo · Enter liga · Esc volta ao mapa');
  return regioes;
}

/** Desenha o desafio aberto (se houver) e devolve suas regiões clicáveis. */
export function desenharDesafio(ctx: Ctx, estado: Estado): RegiaoClicavel[] {
  const aberto = estado.desafio;
  const definicao = estado.fase.desafios.find((terminal) => terminal.nome === aberto?.nome)?.desafio;
  if (aberto === null || definicao === undefined) return [];
  if (aberto.tipo === 'montagem' && definicao.tipo === 'montagem') return desenharMontagem(ctx, definicao, aberto);
  if (aberto.tipo === 'espelho' && definicao.tipo === 'espelho') return desenharEspelho(ctx, definicao, aberto);
  return [];
}
