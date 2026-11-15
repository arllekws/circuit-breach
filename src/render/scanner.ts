import { tabelaDoScanner } from '../jogo/scanner';
import type { Circuito, Estado } from '../jogo/tipos';
import { contornar, escrever, linha, preencher, type Ctx } from './desenho';
import { PAINEL } from './layout';
import { CORES, fonte } from './tema';

// Scanner: tabela-verdade do circuito em foco, abaixo do circuito.
// Linha atual em ciano (com ">"); linhas-alvo em verde (com "◄ alvo").

const MARGEM = 10;
const ALTURA_DA_LINHA = 13;
const ESPACO = 12; // respiro entre colunas

/** Desenha a tabela a partir de `y`; se não couber no painel, não desenha as colunas do meio. */
export function desenharScanner(ctx: Ctx, estado: Estado, circuito: Circuito, y: number): void {
  const x = PAINEL.x + MARGEM;
  const larguraDisponivel = PAINEL.w - MARGEM * 2 - 12 - 46; // marcador ">" e rótulo "◄ alvo"
  const tabela = tabelaDoScanner(circuito, estado.valoracao);

  linha(ctx, [[x, y], [PAINEL.x + PAINEL.w - MARGEM, y]], CORES.bordaPainel);
  escrever(ctx, 'SCANNER · tabela-verdade', x, y + 12, { cor: CORES.textoSecundario });

  // Colunas: todas as proposições e subfórmulas; se não couber, só proposições + saída.
  ctx.font = fonte();
  const largura = (texto: string): number => Math.max(ctx.measureText(texto).width, 8) + ESPACO;
  let indices = tabela.colunas.map((_, i) => i);
  const total = (quais: number[]): number =>
    quais.reduce((soma, i) => soma + largura(tabela.colunas[i] ?? ''), 0);
  if (total(indices) > larguraDisponivel) {
    indices = indices.filter((i) => i < tabela.proposicoes || i === tabela.colunas.length - 1);
  }

  const x0 = x + 12;
  const centros: number[] = [];
  let cursor = x0;
  for (const i of indices) {
    const w = largura(tabela.colunas[i] ?? '');
    centros.push(cursor + w / 2);
    cursor += w;
  }
  const fim = cursor;

  const yCabecalho = y + 30;
  indices.forEach((i, k) => {
    const ehSaida = i === tabela.colunas.length - 1;
    escrever(ctx, tabela.colunas[i] ?? '', centros[k] ?? 0, yCabecalho, {
      alinhar: 'center',
      negrito: ehSaida,
    });
  });
  linha(ctx, [[x0, yCabecalho + 8], [fim, yCabecalho + 8]], CORES.zero);

  tabela.linhas.forEach((linhaDaTabela, n) => {
    const yLinha = yCabecalho + 16 + n * ALTURA_DA_LINHA;
    if (yLinha + ALTURA_DA_LINHA / 2 > PAINEL.y + PAINEL.h - 4) return; // não cabe: não vaza do painel
    const faixa = { x: x0 - 2, y: yLinha - ALTURA_DA_LINHA / 2, w: fim - x0 + 4, h: ALTURA_DA_LINHA };
    let cor: string = CORES.texto;
    if (linhaDaTabela.alvo) cor = CORES.sucesso;
    if (linhaDaTabela.atual) {
      // Linha atual: faixa ciano preenchida, texto escuro, e o marcador ">" à esquerda.
      preencher(ctx, faixa, CORES.um);
      cor = CORES.fundoTela;
      escrever(ctx, '>', x + 4, yLinha, { cor: CORES.um, alinhar: 'center', negrito: true });
    } else if (linhaDaTabela.alvo) {
      contornar(ctx, faixa, CORES.sucesso);
    }
    indices.forEach((i, k) => {
      escrever(ctx, String(linhaDaTabela.valores[i] ?? ''), centros[k] ?? 0, yLinha + 0.5, {
        cor,
        alinhar: 'center',
        negrito: i === tabela.colunas.length - 1,
      });
    });
    if (linhaDaTabela.alvo) {
      escrever(ctx, '◄ alvo', fim + 8, yLinha + 0.5, { cor: CORES.sucesso });
    }
  });
}
