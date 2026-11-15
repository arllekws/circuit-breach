import { novoEstado } from './estado';
import {
  estrelasPara,
  interruptorAoAlcance,
  limiteAlerta,
  mesmaPosicao,
  podeEntrar,
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
  }
}

function mover(estado: Estado, direcao: Direcao): Estado {
  const destino = vizinha(estado.jogador, direcao);
  if (!podeEntrar(estado, destino)) {
    return { ...estado, direcao, evento: 'bloqueado' };
  }
  if (mesmaPosicao(destino, estado.fase.saida)) {
    return {
      ...estado,
      jogador: destino,
      direcao,
      situacao: 'vitoria',
      estrelas: estrelasPara(estado.trocas, estado.fase.minimo),
      evento: 'vitoria',
    };
  }
  return { ...estado, jogador: destino, direcao, evento: 'andou' };
}

/** Tecla E: troca o interruptor ao alcance. Cada troca muda a valoração e soma 1 ao alerta. */
function interagir(estado: Estado): Estado {
  const interruptor = interruptorAoAlcance(estado);
  if (interruptor === undefined) return { ...estado, evento: 'bloqueado' };

  // Todos os interruptores com a mesma letra compartilham a proposição: mudam juntos.
  const valoracao = {
    ...estado.valoracao,
    [interruptor.nome]: estado.valoracao[interruptor.nome] === 1 ? 0 : 1,
  } as const;
  const alerta = estado.alerta + 1;

  if (alerta > limiteAlerta(estado.fase)) {
    return novoEstado(estado.fase, 'alerta_estourou');
  }
  return { ...estado, valoracao, alerta, trocas: estado.trocas + 1, evento: 'troca' };
}
