import { describe, expect, it } from 'vitest';
import fase11 from '../../src/fases/dados/1-1.json';
import { novoEstado } from '../../src/jogo/estado';
import {
  circuitoEmFoco,
  estrelasPara,
  limiteAlerta,
  portaAberta,
} from '../../src/jogo/regras';
import { faseDe, jogar } from '../apoio';

const fase = faseDe(fase11);
const inicio = () => novoEstado(fase);

// Trechos do caminho da fase 1-1 (início em (2,3); P em (4,1); Q em (8,1); porta em (6,5)).
const ATE_P = '^^>>'; // encosta em P, olhando para a direita
const DE_P_ATE_Q = 'v>>>>^>'; // contorna e encosta em Q
const DE_Q_ATE_A_SAIDA = 'vvv<vvv>>>>';

describe('novoEstado', () => {
  it('começa no início da fase, com a valoração inicial e alerta zerado', () => {
    const estado = inicio();
    expect(estado.jogador).toEqual({ x: 2, y: 3 });
    expect(estado.valoracao).toEqual({ P: 1, Q: 0 });
    expect(estado.alerta).toBe(0);
    expect(estado.trocas).toBe(0);
    expect(estado.situacao).toBe('jogando');
  });
});

describe('mover', () => {
  it('anda uma célula por vez', () => {
    expect(jogar(inicio(), '>').jogador).toEqual({ x: 3, y: 3 });
    expect(jogar(inicio(), 'v').jogador).toEqual({ x: 2, y: 4 });
  });

  it('não atravessa parede', () => {
    const estado = jogar(inicio(), '<<<');
    expect(estado.jogador).toEqual({ x: 1, y: 3 });
    expect(estado.evento).toBe('bloqueado');
  });

  it('não atravessa interruptor', () => {
    expect(jogar(inicio(), ATE_P).jogador).toEqual({ x: 3, y: 1 });
  });

  it('não atravessa porta fechada', () => {
    const estado = jogar(inicio(), '>>>> v v');
    expect(estado.jogador).toEqual({ x: 6, y: 4 });
    expect(estado.evento).toBe('bloqueado');
  });

  it('é uma função pura: o estado anterior não muda', () => {
    const antes = inicio();
    jogar(antes, '>>');
    expect(antes.jogador).toEqual({ x: 2, y: 3 });
  });
});

describe('interagir com interruptor', () => {
  it('troca o valor da proposição e soma 1 ao alerta', () => {
    const estado = jogar(inicio(), `${ATE_P} e`);
    expect(estado.valoracao).toEqual({ P: 0, Q: 0 });
    expect(estado.alerta).toBe(1);
    expect(estado.trocas).toBe(1);
    expect(estado.evento).toBe('troca');
  });

  it('trocar de novo volta ao valor anterior (e soma alerta outra vez)', () => {
    const estado = jogar(inicio(), `${ATE_P} ee`);
    expect(estado.valoracao).toEqual({ P: 1, Q: 0 });
    expect(estado.alerta).toBe(2);
  });

  it('longe de qualquer interruptor, E não faz nada', () => {
    const estado = jogar(inicio(), 'e');
    expect(estado.valoracao).toEqual({ P: 1, Q: 0 });
    expect(estado.alerta).toBe(0);
  });

  it('interruptores com a mesma letra mudam juntos (compartilham a proposição)', () => {
    const duplicada = faseDe({
      ...fase11,
      interruptores: [...fase11.interruptores, { nome: 'P', em: [1, 1] }],
    });
    const estado = jogar(novoEstado(duplicada), `${ATE_P} e`);
    expect(estado.valoracao['P']).toBe(0); // um único valor para os dois interruptores P
  });
});

describe('porta controlada por circuito', () => {
  it('fase 1-1: segue o exemplo do relatório passo a passo', () => {
    const porta = fase.portas[0]!;
    let estado = inicio();
    expect(portaAberta(estado, porta)).toBe(false); // ¬P = 0 → trancada

    estado = jogar(estado, `${ATE_P} e`);
    expect(portaAberta(estado, porta)).toBe(false); // ¬P = 1, mas Q = 0

    estado = jogar(estado, `${DE_P_ATE_Q} e`);
    expect(estado.valoracao).toEqual({ P: 0, Q: 1 });
    expect(portaAberta(estado, porta)).toBe(true); // 1 ∧ 1 = 1 → aberta
  });

  it('fecha de novo se o circuito voltar a 0', () => {
    const porta = fase.portas[0]!;
    const estado = jogar(inicio(), `${ATE_P} e ${DE_P_ATE_Q} e e`);
    expect(portaAberta(estado, porta)).toBe(false);
  });

  it('o painel foca o circuito mais próximo do jogador', () => {
    expect(circuitoEmFoco(inicio())?.texto).toBe('NOT P AND Q');
  });
});

describe('vitória e estrelas', () => {
  it('fase 1-1 resolvida com o mínimo de 2 trocas vale 3 estrelas', () => {
    const estado = jogar(inicio(), `${ATE_P} e ${DE_P_ATE_Q} e ${DE_Q_ATE_A_SAIDA}`);
    expect(estado.situacao).toBe('vitoria');
    expect(estado.trocas).toBe(2);
    expect(estado.estrelas).toBe(3);
    expect(estado.jogador).toEqual(fase.saida);
  });

  it('com 2 trocas extras vale 2 estrelas', () => {
    const estado = jogar(inicio(), `${ATE_P} eee ${DE_P_ATE_Q} e ${DE_Q_ATE_A_SAIDA}`);
    expect(estado.situacao).toBe('vitoria');
    expect(estado.trocas).toBe(4);
    expect(estado.estrelas).toBe(2);
  });

  it('regra das estrelas: 3 no mínimo, 2 com até 2 extras, 1 para qualquer solução', () => {
    expect(estrelasPara(2, 2)).toBe(3);
    expect(estrelasPara(3, 2)).toBe(2);
    expect(estrelasPara(4, 2)).toBe(2);
    expect(estrelasPara(5, 2)).toBe(1);
    expect(estrelasPara(9, 2)).toBe(1);
  });

  it('depois da vitória, mover e interagir não fazem mais nada', () => {
    const venceu = jogar(inicio(), `${ATE_P} e ${DE_P_ATE_Q} e ${DE_Q_ATE_A_SAIDA}`);
    expect(jogar(venceu, '<<e')).toEqual(venceu);
  });
});

describe('nível de alerta', () => {
  it('limite = mínimo de trocas + folga', () => {
    expect(fase.minimo).toBe(2);
    expect(limiteAlerta(fase)).toBe(5);
  });

  it('chegar exatamente ao limite ainda é permitido', () => {
    const estado = jogar(inicio(), `${ATE_P} eeeee`);
    expect(estado.alerta).toBe(5);
    expect(estado.evento).toBe('troca');
  });

  it('estourar o limite reinicia a fase', () => {
    const estado = jogar(inicio(), `${ATE_P} eeeeee`);
    expect(estado.evento).toBe('alerta_estourou');
    expect(estado.alerta).toBe(0);
    expect(estado.trocas).toBe(0);
    expect(estado.jogador).toEqual(fase.inicio);
    expect(estado.valoracao).toEqual({ P: 1, Q: 0 });
  });
});

describe('reiniciar e pausar', () => {
  it('R volta ao estado inicial da fase', () => {
    const estado = jogar(inicio(), `${ATE_P} e r`);
    expect(estado).toEqual({ ...inicio(), evento: 'reinicio' });
  });

  it('pausado, o jogo ignora movimento; Esc de novo retoma', () => {
    const pausado = jogar(inicio(), 'p >>');
    expect(pausado.situacao).toBe('pausado');
    expect(pausado.jogador).toEqual({ x: 2, y: 3 });
    expect(jogar(pausado, 'p >').jogador).toEqual({ x: 3, y: 3 });
  });
});
