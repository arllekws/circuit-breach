// Progresso do jogador: melhor número de estrelas em cada fase, salvo no navegador.
// O armazenamento é recebido por parâmetro (localStorage em produção, um objeto falso nos testes).

/** Estrelas (1 a 3) por id de fase; fase ausente = ainda não vencida. */
export type Progresso = Readonly<Record<string, number>>;

export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

const CHAVE = 'circuit-breach:progresso:v1';

/** Lê o progresso salvo; qualquer coisa ausente ou corrompida vira progresso vazio. */
export function carregarProgresso(armazenamento: Armazenamento): Progresso {
  try {
    const bruto: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '{}');
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return {};
    const progresso: Record<string, number> = {};
    for (const [id, estrelas] of Object.entries(bruto)) {
      if (estrelas === 1 || estrelas === 2 || estrelas === 3) progresso[id] = estrelas;
    }
    return progresso;
  } catch {
    return {};
  }
}

export function salvarProgresso(armazenamento: Armazenamento, progresso: Progresso): void {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(progresso));
  } catch {
    // Navegador sem armazenamento (modo privado, cota cheia): o jogo segue sem salvar.
  }
}

/** Registra uma vitória, guardando sempre o melhor resultado da fase. */
export function registrarVitoria(progresso: Progresso, id: string, estrelas: number): Progresso {
  return { ...progresso, [id]: Math.max(progresso[id] ?? 0, estrelas) };
}

/** A primeira fase está sempre liberada; cada outra libera quando a anterior é vencida. */
export function faseLiberada(ids: readonly string[], progresso: Progresso, indice: number): boolean {
  if (indice <= 0) return true;
  const anterior = ids[indice - 1];
  return anterior !== undefined && (progresso[anterior] ?? 0) > 0;
}

export function totalDeEstrelas(progresso: Progresso): number {
  return Object.values(progresso).reduce((soma, estrelas) => soma + estrelas, 0);
}
