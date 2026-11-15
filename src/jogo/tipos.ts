import type { Formula, Valoracao } from '../logica/tipos';

// Camada de jogo: estado + funções puras. Conhece logica/, não conhece DOM nem Canvas.

export interface Posicao {
  readonly x: number;
  readonly y: number;
}

export type Direcao = 'cima' | 'baixo' | 'esquerda' | 'direita';

/** Interruptor do mapa: uma proposição. Interruptores com o mesmo nome mudam juntos. */
export interface Interruptor {
  readonly nome: string;
  readonly em: Posicao;
}

/** Placa de pressão: proposição que vale 1 enquanto houver caixa ou o jogador sobre ela. */
export interface Placa {
  readonly nome: string;
  readonly em: Posicao;
}

/**
 * Elemento do mapa controlado por um circuito (uma fórmula).
 * Porta e ponte precisam que a fórmula dê 1; laser precisa que dê 0.
 */
export interface Circuito {
  readonly id: string;
  readonly tipo: 'porta' | 'ponte' | 'laser';
  readonly em: Posicao;
  /** Fórmula como escrita no JSON da fase, ex.: "(P -> Q) AND R". */
  readonly texto: string;
  readonly formula: Formula;
}

/** Fase já validada (ver fases/validar.ts). */
export interface Fase {
  readonly id: string;
  readonly setor: string;
  readonly titulo: string;
  readonly dica: string;
  readonly largura: number;
  readonly altura: number;
  /** paredes[y][x] === true quando a célula é parede. */
  readonly paredes: readonly (readonly boolean[])[];
  readonly inicio: Posicao;
  readonly saida: Posicao;
  /** Valoração inicial: o valor de cada proposição (interruptores e placas) ao entrar na fase. */
  readonly entradas: Valoracao;
  readonly interruptores: readonly Interruptor[];
  readonly placas: readonly Placa[];
  /** Posição inicial das caixas. */
  readonly caixas: readonly Posicao[];
  readonly portas: readonly Circuito[];
  readonly lasers: readonly Circuito[];
  readonly folgaAlerta: number;
  /** Mínimo de trocas para resolver, calculado pelo validador (nunca escrito à mão). */
  readonly minimo: number;
}

export type Situacao = 'jogando' | 'pausado' | 'vitoria';

/** O que acabou de acontecer — o render usa para dar retorno visual; não muda regra. */
export type Evento =
  | 'inicio'
  | 'andou'
  | 'bloqueado'
  | 'troca'
  | 'scanner'
  | 'alarme'
  | 'alerta_estourou'
  | 'reinicio'
  | 'vitoria';

export interface Estado {
  readonly fase: Fase;
  readonly jogador: Posicao;
  readonly direcao: Direcao;
  readonly caixas: readonly Posicao[];
  /** Valoração atual: valor de todas as proposições (interruptores e placas) neste instante. */
  readonly valoracao: Valoracao;
  readonly alerta: number;
  readonly trocas: number;
  /** Ids dos circuitos cuja tabela-verdade já foi revelada pelo Scanner. */
  readonly escaneados: readonly string[];
  readonly situacao: Situacao;
  /** Estrelas ganhas; só é diferente de 0 depois da vitória. */
  readonly estrelas: 0 | 1 | 2 | 3;
  readonly evento: Evento;
}

export type Acao =
  | { readonly tipo: 'mover'; readonly direcao: Direcao }
  | { readonly tipo: 'interagir' }
  | { readonly tipo: 'scanner' }
  | { readonly tipo: 'reiniciar' }
  | { readonly tipo: 'pausar' };
