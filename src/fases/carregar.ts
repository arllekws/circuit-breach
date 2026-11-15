import type { Fase } from '../jogo/tipos';
import { validarFase } from './validar';

// O Vite embute todos os JSON de dados/ no pacote final.
const arquivos = import.meta.glob<unknown>('./dados/*.json', { eager: true, import: 'default' });

/**
 * Carrega e valida todas as fases, em ordem de id ("1-1", "1-2", "2-1", …).
 * Uma fase inválida interrompe a carga com a lista de problemas: fase quebrada não entra no jogo.
 */
export function carregarFases(): Fase[] {
  const fases: Fase[] = [];
  for (const [caminho, json] of Object.entries(arquivos)) {
    const resultado = validarFase(json);
    if (!resultado.ok) {
      throw new Error(`Fase inválida em ${caminho}:\n- ${resultado.erros.join('\n- ')}`);
    }
    fases.push(resultado.fase);
  }
  return fases.sort((x, y) => x.id.localeCompare(y.id, 'pt-BR', { numeric: true }));
}
