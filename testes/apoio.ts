import { validarFase } from '../src/fases/validar';
import { aplicar } from '../src/jogo/aplicar';
import type { Acao, Estado, Fase } from '../src/jogo/tipos';

/** Valida um JSON de fase e devolve a fase, falhando o teste com os erros se for inválida. */
export function faseDe(json: unknown): Fase {
  const resultado = validarFase(json);
  if (!resultado.ok) throw new Error(`Fase inválida:\n- ${resultado.erros.join('\n- ')}`);
  return resultado.fase;
}

const COMANDOS: Readonly<Record<string, Acao>> = {
  '^': { tipo: 'mover', direcao: 'cima' },
  v: { tipo: 'mover', direcao: 'baixo' },
  '<': { tipo: 'mover', direcao: 'esquerda' },
  '>': { tipo: 'mover', direcao: 'direita' },
  e: { tipo: 'interagir' },
  r: { tipo: 'reiniciar' },
  p: { tipo: 'pausar' },
};

/**
 * Executa uma sequência de comandos: ^ v < > movem, "e" interage, "r" reinicia, "p" pausa.
 * Espaços são ignorados (servem para separar etapas).
 */
export function jogar(estado: Estado, comandos: string): Estado {
  let atual = estado;
  for (const simbolo of comandos.replace(/\s/g, '')) {
    const acao = COMANDOS[simbolo];
    if (acao === undefined) throw new Error(`Comando desconhecido: "${simbolo}"`);
    atual = aplicar(atual, acao);
  }
  return atual;
}
