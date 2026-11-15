import { abrirDesafio, aplicarNoDesafio } from './desafios';
import { novoEstado } from './estado';
import {
  algumLaserLigado,
  caixaPodeIrPara,
  circuitoEmFoco,
  CUSTO_DO_SCANNER,
  estrelasPara,
  interruptorAoAlcance,
  limiteAlerta,
  mesmaPosicao,
  podeEntrar,
  terminalAoAlcance,
  valoracaoComPlacas,
  vizinha,
} from './regras';
import type { Acao, Direcao, Estado } from './tipos';

/**
 * Único ponto onde as regras do jogo mudam o estado.
 * Função pura: recebe o estado e uma ação, devolve o novo estado (o antigo não é alterado).
 */
export function aplicar(estado: Estado, acao: Acao): Estado {
  if (acao.tipo === 'reiniciar') {
    return novoEstado(estado.fase, 'reinicio');
  }
  if (estado.desafio !== null && estado.situacao === 'jogando') {
    // Com um desafio aberto, Esc volta ao mapa (sem perder nada) e o resto vai para o desafio.
    if (acao.tipo === 'pausar') return { ...estado, desafio: null, evento: 'desafio_fechado' };
    return aplicarNoDesafio(estado, acao);
  }
  if (acao.tipo === 'pausar') {
    if (estado.situacao === 'jogando') return { ...estado, situacao: 'pausado' };
    if (estado.situacao === 'pausado') return { ...estado, situacao: 'jogando' };
    return estado;
  }
  if (estado.situacao !== 'jogando') return estado;

  switch (acao.tipo) {
    case 'mover':
      return mover(estado, acao.direcao);
    case 'interagir':
      return interagir(estado);
    case 'scanner':
      return usarScanner(estado);
    default:
      return estado; // ações de desafio sem desafio aberto não fazem nada
  }
}

function mover(estado: Estado, direcao: Direcao): Estado {
  const destino = vizinha(estado.jogador, direcao);
  const bloqueado: Estado = { ...estado, direcao, evento: 'bloqueado' };
  if (!podeEntrar(estado, destino)) return bloqueado;

  // Caixa no caminho: é empurrada uma célula, se houver chão livre atrás dela.
  let caixas = estado.caixas;
  if (caixas.some((caixa) => mesmaPosicao(caixa, destino))) {
    const alem = vizinha(destino, direcao);
    if (!caixaPodeIrPara(estado, alem)) return bloqueado;
    caixas = caixas.map((caixa) => (mesmaPosicao(caixa, destino) ? alem : caixa));
  }

  // Andar ou empurrar pode pisar/soltar placas de pressão: a valoração muda sem custar alerta.
  const valoracao = valoracaoComPlacas(estado.fase.placas, estado.valoracao, destino, caixas);
  if (algumLaserLigado(estado.fase, valoracao)) {
    return novoEstado(estado.fase, 'alarme');
  }

  const andou: Estado = { ...estado, jogador: destino, direcao, caixas, valoracao, evento: 'andou' };
  if (mesmaPosicao(destino, estado.fase.saida)) {
    return {
      ...andou,
      situacao: 'vitoria',
      estrelas: estrelasPara(estado.trocas, estado.fase.minimo, estado.erros),
      evento: 'vitoria',
    };
  }
  return andou;
}

/**
 * Tecla E: troca o interruptor ao alcance (cada troca muda a valoração e soma 1 ao alerta)
 * ou abre o terminal de desafio encostado.
 */
function interagir(estado: Estado): Estado {
  const interruptor = interruptorAoAlcance(estado);
  if (interruptor === undefined) {
    // Sem interruptor por perto: E abre o terminal de desafio encostado, se ainda não foi resolvido.
    const terminal = terminalAoAlcance(estado);
    if (terminal === undefined || estado.valoracao[terminal.nome] === 1) {
      return { ...estado, evento: 'bloqueado' };
    }
    return { ...estado, desafio: abrirDesafio(terminal), evento: 'desafio_aberto' };
  }

  // Todos os interruptores com a mesma letra compartilham a proposição: mudam juntos.
  const valoracao = {
    ...estado.valoracao,
    [interruptor.nome]: estado.valoracao[interruptor.nome] === 1 ? 0 : 1,
  } as const;

  // Laser é instantâneo: se algum circuito de laser der 1 na nova valoração, o alarme toca
  // e o jogador volta ao início — mesmo que fosse só um estado intermediário.
  if (algumLaserLigado(estado.fase, valoracao)) {
    return novoEstado(estado.fase, 'alarme');
  }
  const alerta = estado.alerta + 1;
  if (alerta > limiteAlerta(estado.fase)) {
    return novoEstado(estado.fase, 'alerta_estourou');
  }
  return { ...estado, valoracao, alerta, trocas: estado.trocas + 1, evento: 'troca' };
}

/**
 * Tecla Q: revela a tabela-verdade do circuito em foco. Soma 2 ao alerta (uma vez por
 * circuito); não conta como troca, então não tira estrelas.
 */
function usarScanner(estado: Estado): Estado {
  const circuito = circuitoEmFoco(estado);
  if (circuito === undefined || estado.escaneados.includes(circuito.id)) {
    return { ...estado, evento: 'bloqueado' };
  }
  const alerta = estado.alerta + CUSTO_DO_SCANNER;
  if (alerta > limiteAlerta(estado.fase)) {
    return novoEstado(estado.fase, 'alerta_estourou');
  }
  return { ...estado, alerta, escaneados: [...estado.escaneados, circuito.id], evento: 'scanner' };
}
