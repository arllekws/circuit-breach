import { avaliar } from '../logica/avaliar';
import type { Circuito, Direcao, Estado, Fase, Interruptor, Posicao } from './tipos';

export const DESLOCAMENTO: Readonly<Record<Direcao, Posicao>> = {
  cima: { x: 0, y: -1 },
  baixo: { x: 0, y: 1 },
  esquerda: { x: -1, y: 0 },
  direita: { x: 1, y: 0 },
};

export const mesmaPosicao = (p: Posicao, q: Posicao): boolean => p.x === q.x && p.y === q.y;

export const vizinha = (p: Posicao, direcao: Direcao): Posicao => ({
  x: p.x + DESLOCAMENTO[direcao].x,
  y: p.y + DESLOCAMENTO[direcao].y,
});

/** Limite do nível de alerta: mínimo de trocas necessário + folga da fase. */
export function limiteAlerta(fase: Fase): number {
  return fase.minimo + fase.folgaAlerta;
}

/** Estrelas: 3 com o mínimo de trocas, 2 com até 2 trocas extras, 1 para qualquer solução. */
export function estrelasPara(trocas: number, minimo: number): 1 | 2 | 3 {
  const extras = trocas - minimo;
  if (extras <= 0) return 3;
  if (extras <= 2) return 2;
  return 1;
}

/** Saída atual do circuito: avalia a fórmula na valoração do estado. */
export function saidaDoCircuito(estado: Estado, circuito: Circuito): boolean {
  return avaliar(circuito.formula, estado.valoracao);
}

/** Porta/ponte aberta ⇔ sua fórmula dá 1 na valoração atual. */
export function portaAberta(estado: Estado, porta: Circuito): boolean {
  return saidaDoCircuito(estado, porta);
}

export function interruptorEm(fase: Fase, p: Posicao): Interruptor | undefined {
  return fase.interruptores.find((i) => mesmaPosicao(i.em, p));
}

function parede(fase: Fase, p: Posicao): boolean {
  return fase.paredes[p.y]?.[p.x] !== false; // fora do mapa conta como parede
}

/** O jogador pode entrar nesta célula agora? */
export function podeEntrar(estado: Estado, p: Posicao): boolean {
  const { fase } = estado;
  if (parede(fase, p)) return false;
  if (interruptorEm(fase, p) !== undefined) return false;
  const porta = fase.portas.find((c) => mesmaPosicao(c.em, p));
  return porta === undefined || portaAberta(estado, porta);
}

/**
 * Interruptor ao alcance do jogador: primeiro o que está à frente; senão, qualquer
 * um encostado (cima, direita, baixo, esquerda).
 */
export function interruptorAoAlcance(estado: Estado): Interruptor | undefined {
  const ordem: Direcao[] = [estado.direcao, 'cima', 'direita', 'baixo', 'esquerda'];
  for (const direcao of ordem) {
    const achado = interruptorEm(estado.fase, vizinha(estado.jogador, direcao));
    if (achado !== undefined) return achado;
  }
  return undefined;
}

/** Circuito mostrado no painel: o do elemento (porta, ponte ou laser) mais próximo do jogador. */
export function circuitoEmFoco(estado: Estado): Circuito | undefined {
  const distancia = (c: Circuito): number =>
    Math.abs(c.em.x - estado.jogador.x) + Math.abs(c.em.y - estado.jogador.y);
  let maisProximo: Circuito | undefined;
  for (const circuito of [...estado.fase.portas, ...estado.fase.lasers]) {
    if (maisProximo === undefined || distancia(circuito) < distancia(maisProximo)) {
      maisProximo = circuito;
    }
  }
  return maisProximo;
}
