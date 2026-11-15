import type { Estado, Evento, Fase } from './tipos';

/** Estado inicial de uma fase: jogador no início, proposições na valoração inicial, alerta zerado. */
export function novoEstado(fase: Fase, evento: Evento = 'inicio'): Estado {
  return {
    fase,
    jogador: fase.inicio,
    direcao: 'baixo',
    caixas: fase.caixas,
    valoracao: fase.entradas,
    alerta: 0,
    trocas: 0,
    escaneados: [],
    situacao: 'jogando',
    estrelas: 0,
    evento,
  };
}
