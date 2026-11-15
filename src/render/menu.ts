import { faseLiberada, totalDeEstrelas, type Progresso } from '../jogo/progresso';
import type { Fase } from '../jogo/tipos';
import { contornar, escrever, estrela, preencher, type Ctx } from './desenho';
import { TELA, type Retangulo } from './layout';
import { CORES } from './tema';

// Menu de fases: uma linha por setor, duas fases por linha.

export const FASES_POR_LINHA = 2;
const CARTAO = { w: 232, h: 40, vaoX: 10, vaoY: 8 };
const TOPO = 96;
const ESQUERDA = 172;

function cartao(indice: number): Retangulo {
  const coluna = indice % FASES_POR_LINHA;
  const fileira = Math.floor(indice / FASES_POR_LINHA);
  return {
    x: ESQUERDA + coluna * (CARTAO.w + CARTAO.vaoX),
    y: TOPO + fileira * (CARTAO.h + CARTAO.vaoY),
    w: CARTAO.w,
    h: CARTAO.h,
  };
}

export function desenharMenu(ctx: Ctx, fases: readonly Fase[], progresso: Progresso, selecionada: number): void {
  preencher(ctx, { x: 0, y: 0, w: TELA.w, h: TELA.h }, CORES.fundoTela);
  escrever(ctx, 'CIRCUIT BREACH', TELA.w / 2, 34, { tamanho: 24, negrito: true, alinhar: 'center' });
  escrever(ctx, 'O Hacker Lógico · cada porta é uma fórmula', TELA.w / 2, 60, {
    cor: CORES.textoSecundario,
    alinhar: 'center',
  });

  const ids = fases.map((fase) => fase.id);
  fases.forEach((fase, i) => {
    const r = cartao(i);
    const liberada = faseLiberada(ids, progresso, i);
    const estrelas = progresso[fase.id] ?? 0;
    const meio = r.y + r.h / 2;

    // Nome do setor à esquerda da primeira fase de cada linha.
    if (i % FASES_POR_LINHA === 0) {
      escrever(ctx, `${fase.id.split('-')[0]} · ${fase.setor}`, ESQUERDA - 12, meio, {
        cor: CORES.textoSecundario,
        alinhar: 'right',
      });
    }

    preencher(ctx, r, CORES.painel);
    // A fase escolhida tem a borda âmbar (a cor do jogador) e o marcador ">".
    contornar(ctx, r, i === selecionada ? CORES.jogador : CORES.bordaPainel, i === selecionada ? 2 : 1);
    if (i === selecionada) escrever(ctx, '>', r.x + 8, meio, { cor: CORES.jogador, negrito: true });

    const cor = liberada ? CORES.texto : CORES.textoSecundario;
    escrever(ctx, fase.id, r.x + 20, meio, { cor, negrito: true, tamanho: 13 });
    if (liberada) {
      escrever(ctx, fase.titulo.slice(0, 16), r.x + 52, meio, { cor });
      for (let e = 0; e < 3; e++) {
        estrela(ctx, r.x + r.w - 52 + e * 18, meio, 6, e < estrelas, CORES.jogador);
      }
    } else {
      escrever(ctx, 'bloqueada', r.x + 52, meio, { cor });
    }
  });

  const total = totalDeEstrelas(progresso);
  estrela(ctx, TELA.w / 2 - 44, 78, 6, true, CORES.jogador);
  escrever(ctx, `${total} / ${fases.length * 3}`, TELA.w / 2 - 32, 78.5, { negrito: true });

  escrever(ctx, 'Setas/WASD escolher · Enter jogar', TELA.w / 2, TELA.h - 11, {
    cor: CORES.textoSecundario,
    alinhar: 'center',
  });
}
