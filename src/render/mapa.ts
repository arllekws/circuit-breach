import { interruptorAoAlcance, portaAberta } from '../jogo/regras';
import type { Circuito, Estado, Posicao } from '../jogo/tipos';
import { variaveis } from '../logica/tabelaVerdade';
import { circulo, contornar, escrever, linha, preencher, type Ctx } from './desenho';
import { AREA_MAPA, origemDoMapa } from './layout';
import { CELULA, CORES } from './tema';

// Desenha o mapa a partir do estado. NÃO decide regra: só pergunta ao jogo (ex.: portaAberta).

/**
 * @param posicaoVisual posição do hacker em células (pode ser fracionária durante a animação).
 */
export function desenharMapa(ctx: Ctx, estado: Estado, posicaoVisual: Posicao): void {
  const { fase } = estado;
  const origem = origemDoMapa(fase);
  const celula = (p: Posicao) => ({
    x: origem.x + p.x * CELULA,
    y: origem.y + p.y * CELULA,
    w: CELULA,
    h: CELULA,
  });
  const centro = (p: Posicao): [number, number] => [
    origem.x + p.x * CELULA + CELULA / 2,
    origem.y + p.y * CELULA + CELULA / 2,
  ];

  preencher(ctx, AREA_MAPA, CORES.fundoMapa);
  contornar(ctx, AREA_MAPA, CORES.bordaPainel);

  // Chão (grade) e paredes.
  for (let y = 0; y < fase.altura; y++) {
    for (let x = 0; x < fase.largura; x++) {
      const r = celula({ x, y });
      if (fase.paredes[y]?.[x] === true) preencher(ctx, r, CORES.parede);
      else contornar(ctx, r, CORES.grade);
    }
  }

  // Linhas tracejadas finas: cada interruptor ligado aos circuitos que ele alimenta.
  const circuitos: Circuito[] = [...fase.portas, ...fase.lasers];
  for (const circuito of circuitos) {
    const usadas = variaveis(circuito.formula);
    for (const interruptor of fase.interruptores) {
      if (!usadas.includes(interruptor.nome)) continue;
      const ligado = estado.valoracao[interruptor.nome] === 1;
      linha(ctx, [centro(interruptor.em), centro(circuito.em)], ligado ? CORES.um : CORES.zero, 1, [3, 4]);
    }
  }

  // Saída: tracejada em verde.
  const saida = celula(fase.saida);
  contornar(ctx, { x: saida.x + 3, y: saida.y + 3, w: CELULA - 6, h: CELULA - 6 }, CORES.sucesso, 2, [4, 3]);

  // Portas: fechada = caixa vermelha com 0; aberta = só os batentes verdes com 1.
  for (const porta of fase.portas) {
    const r = celula(porta.em);
    const [cx, cy] = centro(porta.em);
    if (portaAberta(estado, porta)) {
      preencher(ctx, r, CORES.fundoMapa);
      preencher(ctx, { x: r.x, y: r.y, w: 4, h: CELULA }, CORES.sucesso);
      preencher(ctx, { x: r.x + CELULA - 4, y: r.y, w: 4, h: CELULA }, CORES.sucesso);
      escrever(ctx, '1', cx, cy, { cor: CORES.sucesso, alinhar: 'center', negrito: true });
    } else {
      preencher(ctx, r, CORES.painel);
      contornar(ctx, r, CORES.perigo, 2);
      linha(ctx, [[r.x + 5, cy - 8], [r.x + CELULA - 5, cy - 8]], CORES.perigo, 2);
      escrever(ctx, '0', cx, cy + 3, { cor: CORES.perigo, alinhar: 'center', negrito: true });
    }
  }

  // Interruptores: quadrado com a letra e o dígito. 1 = ciano preenchido; 0 = só contorno.
  const aoAlcance = estado.situacao === 'jogando' ? interruptorAoAlcance(estado) : undefined;
  for (const interruptor of fase.interruptores) {
    const r = celula(interruptor.em);
    const caixa = { x: r.x + 3, y: r.y + 3, w: CELULA - 6, h: CELULA - 6 };
    const [cx, cy] = centro(interruptor.em);
    const valor = estado.valoracao[interruptor.nome] ?? 0;
    if (valor === 1) {
      preencher(ctx, caixa, CORES.um);
    } else {
      preencher(ctx, caixa, CORES.fundoMapa);
      contornar(ctx, caixa, CORES.zero, 1.5);
    }
    const corTexto = valor === 1 ? CORES.fundoTela : CORES.texto;
    escrever(ctx, interruptor.nome, cx, cy - 5, { cor: corTexto, alinhar: 'center', negrito: true, tamanho: 12 });
    escrever(ctx, String(valor), cx, cy + 7, { cor: corTexto, alinhar: 'center' });
    if (interruptor === aoAlcance) {
      // Mostra qual interruptor a tecla E vai trocar.
      contornar(ctx, r, CORES.jogador, 1);
    }
  }

  // O hacker: círculo âmbar, com um ponto indicando para onde está virado.
  const [jx, jy] = centro(posicaoVisual);
  circulo(ctx, jx, jy, 9, CORES.jogador);
  const olhar = { cima: [0, -5], baixo: [0, 5], esquerda: [-5, 0], direita: [5, 0] }[estado.direcao];
  circulo(ctx, jx + (olhar[0] ?? 0), jy + (olhar[1] ?? 0), 2, CORES.fundoTela);
}
