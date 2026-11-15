import { estrelasPara, limiteAlerta } from '../jogo/regras';
import type { Estado } from '../jogo/tipos';
import { contornar, escrever, estrela, preencher, type Ctx } from './desenho';
import { AREA_MAPA, BARRA, RODAPE, TELA, type Retangulo } from './layout';
import { CORES } from './tema';

/** Barra superior: nome da fase, nível de alerta "n / limite" e as 3 estrelas. */
export function desenharBarra(ctx: Ctx, estado: Estado): void {
  preencher(ctx, BARRA, CORES.painel);
  preencher(ctx, { x: 0, y: BARRA.h - 1, w: BARRA.w, h: 1 }, CORES.bordaPainel);
  const meio = BARRA.h / 2;

  escrever(ctx, `Fase ${estado.fase.id} · ${estado.fase.setor}`, 12, meio, { tamanho: 13, negrito: true });

  // Alerta: um segmento por ponto. No limite, a barra fica vermelha (a próxima troca reinicia).
  const limite = limiteAlerta(estado.fase);
  const noLimite = estado.alerta >= limite;
  const cor = noLimite ? CORES.perigo : CORES.texto;
  escrever(ctx, 'ALERTA', 250, meio, { cor: CORES.textoSecundario });
  const barra: Retangulo = { x: 300, y: meio - 6, w: 160, h: 12 };
  const segmento = barra.w / Math.max(limite, 1);
  for (let i = 0; i < limite; i++) {
    const r = { x: barra.x + i * segmento + 1, y: barra.y, w: segmento - 2, h: barra.h };
    if (i < estado.alerta) preencher(ctx, r, cor);
    else contornar(ctx, r, CORES.bordaPainel);
  }
  escrever(ctx, `${estado.alerta} / ${limite}`, 470, meio, { cor, negrito: true });

  // Estrelas que o jogador ainda leva se terminar agora.
  const estrelas = estado.situacao === 'vitoria' ? estado.estrelas : estrelasPara(estado.trocas, estado.fase.minimo);
  for (let i = 0; i < 3; i++) {
    estrela(ctx, 610 + i * 22, meio, 8, i < estrelas, CORES.jogador);
  }
}

/** Rodapé: dica de controles em texto pequeno. */
export function desenharRodape(ctx: Ctx): void {
  escrever(
    ctx,
    'Setas/WASD mover · E interagir · Q scanner · R reiniciar · Esc pausa',
    TELA.w / 2,
    RODAPE.y + RODAPE.h / 2,
    { cor: CORES.textoSecundario, alinhar: 'center' },
  );
}

/** Aviso curto sobre o mapa (ex.: alerta estourado). Aparece e some; não pisca. */
export function desenharAviso(ctx: Ctx, texto: string, cor: string): void {
  const r: Retangulo = { x: AREA_MAPA.x + 8, y: AREA_MAPA.y + 8, w: AREA_MAPA.w - 16, h: 24 };
  preencher(ctx, r, CORES.painel);
  contornar(ctx, r, cor, 1);
  escrever(ctx, texto, r.x + r.w / 2, r.y + r.h / 2, { cor, alinhar: 'center', negrito: true });
}

function caixaCentral(ctx: Ctx, altura: number, cor: string): Retangulo {
  const r: Retangulo = {
    x: AREA_MAPA.x + 40,
    y: AREA_MAPA.y + (AREA_MAPA.h - altura) / 2,
    w: AREA_MAPA.w - 80,
    h: altura,
  };
  preencher(ctx, r, CORES.painel);
  contornar(ctx, r, cor, 2);
  return r;
}

/** Tela de fase concluída: estrelas e número de trocas comparado ao mínimo. */
export function desenharVitoria(ctx: Ctx, estado: Estado, ultimaFase: boolean): void {
  const r = caixaCentral(ctx, 150, CORES.sucesso);
  const cx = r.x + r.w / 2;
  escrever(ctx, 'FASE CONCLUÍDA', cx, r.y + 26, { cor: CORES.sucesso, tamanho: 16, negrito: true, alinhar: 'center' });
  for (let i = 0; i < 3; i++) {
    estrela(ctx, cx - 34 + i * 34, r.y + 62, 13, i < estado.estrelas, CORES.jogador);
  }
  escrever(ctx, `Trocas: ${estado.trocas} · mínimo: ${estado.fase.minimo}`, cx, r.y + 96, { alinhar: 'center' });
  escrever(ctx, ultimaFase ? 'Enter: menu · R: jogar de novo' : 'Enter: próxima fase · R: jogar de novo', cx, r.y + 124, {
    cor: CORES.textoSecundario,
    alinhar: 'center',
  });
}

export function desenharPausa(ctx: Ctx): void {
  const r = caixaCentral(ctx, 90, CORES.texto);
  const cx = r.x + r.w / 2;
  escrever(ctx, 'PAUSADO', cx, r.y + 30, { tamanho: 16, negrito: true, alinhar: 'center' });
  escrever(ctx, 'Esc: continuar · R: reiniciar · Enter: menu', cx, r.y + 62, { cor: CORES.textoSecundario, alinhar: 'center' });
}
