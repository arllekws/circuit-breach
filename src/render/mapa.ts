import { interruptorAoAlcance, portaAberta, terminalAoAlcance } from '../jogo/regras';
import type { Circuito, Estado, Posicao } from '../jogo/tipos';
import { variaveis } from '../logica/tabelaVerdade';
import { circulo, contornar, escrever, linha, preencher, type Ctx } from './desenho';
import { AREA_MAPA, origemDoMapa, type Retangulo } from './layout';
import { CELULA, CORES } from './tema';

// Desenha o mapa a partir do estado. NÃO decide regra: só pergunta ao jogo (ex.: portaAberta).

const dentro = (r: Retangulo, folga: number): Retangulo => ({
  x: r.x + folga,
  y: r.y + folga,
  w: r.w - folga * 2,
  h: r.h - folga * 2,
});

/**
 * @param posicaoVisual posição do hacker em células (pode ser fracionária durante a animação).
 */
export function desenharMapa(ctx: Ctx, estado: Estado, posicaoVisual: Posicao): void {
  const { fase } = estado;
  const origem = origemDoMapa(fase);
  const celula = (p: Posicao): Retangulo => ({
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

  // Linhas tracejadas finas: cada interruptor/placa ligado aos circuitos que alimenta.
  const circuitos: Circuito[] = [...fase.portas, ...fase.lasers];
  for (const circuito of circuitos) {
    const usadas = variaveis(circuito.formula);
    for (const entrada of [...fase.interruptores, ...fase.placas, ...fase.desafios]) {
      if (!usadas.includes(entrada.nome)) continue;
      const ligado = estado.valoracao[entrada.nome] === 1;
      linha(ctx, [centro(entrada.em), centro(circuito.em)], ligado ? CORES.um : CORES.zero, 1, [3, 4]);
    }
  }

  // Saída: tracejada em verde.
  contornar(ctx, dentro(celula(fase.saida), 3), CORES.sucesso, 2, [4, 3]);

  // Placas de pressão: moldura no chão com a letra. 1 = ciano preenchido; 0 = só contorno.
  for (const placa of fase.placas) {
    const caixa = dentro(celula(placa.em), 5);
    const [cx, cy] = centro(placa.em);
    const valor = estado.valoracao[placa.nome] ?? 0;
    if (valor === 1) preencher(ctx, caixa, CORES.um);
    contornar(ctx, caixa, valor === 1 ? CORES.um : CORES.zero, 1, [2, 2]);
    escrever(ctx, `${placa.nome}${valor}`, cx, cy + 0.5, {
      cor: valor === 1 ? CORES.fundoTela : CORES.texto,
      alinhar: 'center',
      negrito: true,
    });
  }

  // Portas e pontes. Fechada = vermelha com 0; aberta = verde com 1 (e formas diferentes).
  for (const porta of fase.portas) {
    const r = celula(porta.em);
    const [cx, cy] = centro(porta.em);
    const aberta = portaAberta(estado, porta);
    if (porta.tipo === 'ponte') {
      if (aberta) {
        // Ponte estendida: tábuas atravessando o vão.
        preencher(ctx, r, CORES.fundoMapa);
        for (const dy of [5, 13, 21]) preencher(ctx, { x: r.x, y: r.y + dy, w: CELULA, h: 4 }, CORES.sucesso);
        escrever(ctx, '1', cx, cy + 0.5, { cor: CORES.texto, alinhar: 'center', negrito: true });
      } else {
        // Ponte recolhida: vão escuro, contorno vermelho tracejado.
        preencher(ctx, r, CORES.fundoTela);
        contornar(ctx, r, CORES.perigo, 2, [4, 3]);
        escrever(ctx, '0', cx, cy + 0.5, { cor: CORES.perigo, alinhar: 'center', negrito: true });
      }
    } else if (aberta) {
      // Porta aberta: só os batentes.
      preencher(ctx, r, CORES.fundoMapa);
      preencher(ctx, { x: r.x, y: r.y, w: 4, h: CELULA }, CORES.sucesso);
      preencher(ctx, { x: r.x + CELULA - 4, y: r.y, w: 4, h: CELULA }, CORES.sucesso);
      escrever(ctx, '1', cx, cy + 0.5, { cor: CORES.sucesso, alinhar: 'center', negrito: true });
    } else {
      // Porta trancada: caixa cheia com a trava.
      preencher(ctx, r, CORES.painel);
      contornar(ctx, r, CORES.perigo, 2);
      linha(ctx, [[r.x + 5, cy - 8], [r.x + CELULA - 5, cy - 8]], CORES.perigo, 2);
      escrever(ctx, '0', cx, cy + 3, { cor: CORES.perigo, alinhar: 'center', negrito: true });
    }
  }

  // Emissores de laser: losango vermelho. Em jogo estão sempre em 0 (se der 1, a fase reinicia).
  for (const laser of fase.lasers) {
    const [cx, cy] = centro(laser.em);
    const raio = CELULA / 2 - 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - raio);
    ctx.lineTo(cx + raio, cy);
    ctx.lineTo(cx, cy + raio);
    ctx.lineTo(cx - raio, cy);
    ctx.closePath();
    ctx.fillStyle = CORES.painel;
    ctx.fill();
    ctx.strokeStyle = CORES.perigo;
    ctx.lineWidth = 2;
    ctx.stroke();
    escrever(ctx, '0', cx, cy + 0.5, { cor: CORES.perigo, alinhar: 'center', negrito: true });
  }

  // Interruptores: quadrado com a letra e o dígito. 1 = ciano preenchido; 0 = só contorno.
  const aoAlcance = estado.situacao === 'jogando' ? interruptorAoAlcance(estado) : undefined;
  for (const interruptor of fase.interruptores) {
    const r = celula(interruptor.em);
    const caixa = dentro(r, 3);
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

  // Terminais de desafio: um monitor com a letra da proposição. 0 = por resolver; 1 = resolvido.
  const terminalPerto =
    estado.situacao === 'jogando' && aoAlcance === undefined ? terminalAoAlcance(estado) : undefined;
  for (const terminal of fase.desafios) {
    const r = celula(terminal.em);
    const tela = { x: r.x + 3, y: r.y + 4, w: CELULA - 6, h: CELULA - 12 };
    const [cx] = centro(terminal.em);
    const valor = estado.valoracao[terminal.nome] ?? 0;
    if (valor === 1) {
      preencher(ctx, tela, CORES.um);
    } else {
      preencher(ctx, tela, CORES.fundoMapa);
      contornar(ctx, tela, CORES.zero, 1.5);
    }
    preencher(ctx, { x: r.x + 8, y: r.y + CELULA - 6, w: CELULA - 16, h: 3 }, valor === 1 ? CORES.um : CORES.zero);
    escrever(ctx, `${terminal.nome}${valor}`, cx, tela.y + tela.h / 2 + 0.5, {
      cor: valor === 1 ? CORES.fundoTela : CORES.texto,
      alinhar: 'center',
      negrito: true,
    });
    if (terminal === terminalPerto && valor === 0) contornar(ctx, r, CORES.jogador, 1);
  }

  // Caixas: bloco chapado com um X (para não confundir com interruptor).
  for (const posicao of estado.caixas) {
    const caixa = dentro(celula(posicao), 4);
    preencher(ctx, caixa, CORES.parede);
    contornar(ctx, caixa, CORES.texto, 1.5);
    linha(ctx, [[caixa.x, caixa.y], [caixa.x + caixa.w, caixa.y + caixa.h]], CORES.texto, 1);
    linha(ctx, [[caixa.x + caixa.w, caixa.y], [caixa.x, caixa.y + caixa.h]], CORES.texto, 1);
  }

  // O hacker: círculo âmbar, com um ponto indicando para onde está virado.
  const [jx, jy] = centro(posicaoVisual);
  circulo(ctx, jx, jy, 9, CORES.jogador);
  const olhar = { cima: [0, -5], baixo: [0, 5], esquerda: [-5, 0], direita: [5, 0] }[estado.direcao];
  circulo(ctx, jx + (olhar[0] ?? 0), jy + (olhar[1] ?? 0), 2, CORES.fundoTela);
}
