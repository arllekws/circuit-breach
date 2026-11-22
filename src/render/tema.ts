// ÚNICA fonte de cores, fonte e medidas do jogo. Nenhum outro arquivo escreve cor em hexadecimal.
// A cor sempre tem significado lógico — e nunca é o único sinal: 1 é cheio, 0 é contorno,
// e o dígito aparece junto. (Tokens do handoff de design, em px lógicos de 680 × 400.)

export const C = {
  /** Fundo geral; texto escuro sobre cores cheias. */
  bg: '#0A111A',
  /** Fundo do mapa e interior de caixas. */
  map: '#0E1621',
  /** Linhas do chão; fundo da linha atual da tabela. */
  grid: '#162434',
  wall: '#243447',
  panel: '#101B28',
  /** Bordas, abas padrão, separadores. */
  border: '#2A3E52',
  /** SOMENTE valor lógico 1 (preenchido). */
  one: '#2DD4BF',
  /** Valor 0 (contorno). */
  zero: '#6B8499',
  /** Perigo, alerta, erro, porta trancada, laser. */
  danger: '#E5484D',
  /** Sucesso, meta, linha-alvo, saída. */
  ok: '#3DD68C',
  /** Jogador, seleção, foco, estrelas. */
  amber: '#F5B342',
  text: '#CFE3F2',
  /** Texto secundário. */
  dim: '#6B8499',
  /** Texto escuro sobre cor cheia. */
  ink: '#0A111A',
} as const;

/** Fonte monoespaçada; as alternativas cobrem quem não tem a JetBrains Mono instalada. */
export const FAMILIA = '"JetBrains Mono", "Cascadia Mono", Consolas, ui-monospace, Menlo, monospace';

/** Menor texto permitido no jogo (px lógicos). */
export const TEXTO_MINIMO = 11;

export function fonte(tamanho = 12, negrito = false): string {
  return `${negrito ? 700 : 400} ${Math.max(tamanho, TEXTO_MINIMO)}px ${FAMILIA}`;
}

/** Lado da célula do mapa, em px. */
export const CELULA = 30;

/** Duração das transições de estado (porta, ponte, hacker andando), em ms. */
export const ANIMACAO_MS = 150;

/** Tenta carregar a fonte antes do primeiro desenho; sem ela, usa as alternativas. */
export async function fonteCarregada(): Promise<void> {
  try {
    await Promise.all([fonte(12, false), fonte(12, true)].map((f) => document.fonts.load(f)));
  } catch {
    // Sem suporte a document.fonts: o navegador usa a próxima fonte da lista.
  }
}
