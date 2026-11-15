import { validarFase } from '../src/fases/validar';
import { aplicar } from '../src/jogo/aplicar';
import { novoEstado } from '../src/jogo/estado';
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
  q: { tipo: 'scanner' },
  r: { tipo: 'reiniciar' },
  p: { tipo: 'pausar' },
};

/**
 * Executa uma sequência de comandos: ^ v < > movem, "e" interage, "q" usa o Scanner,
 * "r" reinicia, "p" pausa. Espaços são ignorados (servem para separar etapas).
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

/**
 * Solucionador para os testes: busca em largura sobre os estados do jogo (posição, direção,
 * caixas, valoração), usando só `aplicar`. Devolve o estado de vitória alcançado com no
 * máximo `maximoDeTrocas` trocas, ou null se a fase não pode ser vencida assim.
 * Prova que a fase é zerável NO MAPA — não só que a fórmula tem solução.
 */
export function resolver(fase: Fase, maximoDeTrocas: number = fase.minimo): Estado | null {
  const acoes: Acao[] = [
    { tipo: 'mover', direcao: 'cima' },
    { tipo: 'mover', direcao: 'baixo' },
    { tipo: 'mover', direcao: 'esquerda' },
    { tipo: 'mover', direcao: 'direita' },
    { tipo: 'interagir' },
  ];
  const chave = (e: Estado): string =>
    JSON.stringify([e.jogador, e.direcao, e.caixas, e.valoracao, e.trocas]);
  const inicial = novoEstado(fase);
  const vistos = new Set([chave(inicial)]);
  let fronteira = [inicial];
  while (fronteira.length > 0) {
    const proxima: Estado[] = [];
    for (const estado of fronteira) {
      for (const acao of acoes) {
        const novo = aplicar(estado, acao);
        if (novo.situacao === 'vitoria') return novo;
        // Reinícios (alarme, alerta) e passos bloqueados não levam a lugar nenhum.
        if (novo.evento !== 'andou' && novo.evento !== 'troca') continue;
        if (novo.trocas > maximoDeTrocas || vistos.has(chave(novo))) continue;
        vistos.add(chave(novo));
        proxima.push(novo);
      }
    }
    fronteira = proxima;
  }
  return null;
}
