// ÚNICA fonte de cores, fonte e medidas do jogo. Nenhum outro arquivo escreve cor em hexadecimal.
// A cor sempre tem significado lógico — e nunca é o único sinal: o dígito 0/1 aparece junto.

export const CORES = {
  fundoTela: '#0A111A',
  fundoMapa: '#0E1621',
  grade: '#162434',
  parede: '#243447',
  painel: '#101B28',
  bordaPainel: '#2A3E52',
  /** Ciano = valor 1 (aceso). */
  um: '#2DD4BF',
  /** Apagado = valor 0 (só contorno, fundo escuro). */
  zero: '#6B8499',
  /** Vermelho = perigo: laser, alarme, porta trancada, passo inválido. */
  perigo: '#E5484D',
  /** Verde = sucesso: saída, resultado certo, linha-alvo do Scanner. */
  sucesso: '#3DD68C',
  /** Âmbar = o jogador e as estrelas. */
  jogador: '#F5B342',
  texto: '#CFE3F2',
  textoSecundario: '#6B8499',
} as const;

const FAMILIA = '"Cascadia Mono", Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

/** Menor texto permitido no jogo (px, na tela de referência 680×400). */
export const TEXTO_MINIMO = 11;

/** Fonte monoespaçada no tamanho pedido (nunca menor que TEXTO_MINIMO). */
export function fonte(tamanho: number = TEXTO_MINIMO, negrito = false): string {
  return `${negrito ? 'bold ' : ''}${Math.max(tamanho, TEXTO_MINIMO)}px ${FAMILIA}`;
}

/** Lado da célula do mapa, em px. */
export const CELULA = 30;

/** Duração das animações, em ms (sempre ≤ 200). */
export const ANIMACAO_MS = 110;
