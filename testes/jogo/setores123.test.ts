import { describe, expect, it } from 'vitest';
import { carregarFases } from '../../src/fases/carregar';
import { novoEstado } from '../../src/jogo/estado';
import { circuitoEmFoco, limiteAlerta, portaAberta } from '../../src/jogo/regras';
import type { Fase } from '../../src/jogo/tipos';
import { jogar } from '../apoio';

const fases = carregarFases();
const fase = (id: string): Fase => {
  const achada = fases.find((f) => f.id === id);
  if (achada === undefined) throw new Error(`Fase ${id} não existe`);
  return achada;
};

// Nas fases 1-2, 2-2 e 3-2 o início é (2,2) e os interruptores P, Q, R ficam em (4,1), (7,1), (10,1).
// Cada trecho termina encostado no interruptor, olhando para ele (à direita).
const ATE_P = '^>>'; // (3,1)
const DE_P_ATE_Q = 'v>>>^>'; // (6,1)
const DE_Q_ATE_R = 'v>>>^>'; // (9,1)
const ATE_Q = `${ATE_P} ${DE_P_ATE_Q}`;
const ATE_R = `${ATE_Q} ${DE_Q_ATE_R}`;

describe('laser: circuito que precisa dar 0 (fase 3-2)', () => {
  const inicio = () => novoEstado(fase('3-2'));

  it('ligar R antes de desligar Q dispara o laser por um instante: alarme e reinício', () => {
    const estado = jogar(inicio(), `${ATE_R} e`);
    expect(estado.evento).toBe('alarme');
    expect(estado.jogador).toEqual(fase('3-2').inicio);
    expect(estado.valoracao).toEqual({ P: 1, Q: 1, R: 0 });
    expect(estado.trocas).toBe(0);
    expect(estado.alerta).toBe(0);
  });

  it('na ordem certa (P, Q, depois R) a porta abre e o laser continua em 0', () => {
    const estado = jogar(inicio(), `${ATE_P} e ${DE_P_ATE_Q} e ${DE_Q_ATE_R} e`);
    expect(estado.evento).toBe('troca');
    expect(estado.valoracao).toEqual({ P: 0, Q: 0, R: 1 });
    expect(portaAberta(estado, fase('3-2').portas[0]!)).toBe(true);
  });

  it('solução completa em 3 trocas vale 3 estrelas', () => {
    // De (9,1) desce pela porta (9,4) até (9,6) e anda até a saída (10,6).
    const estado = jogar(inicio(), `${ATE_P} e ${DE_P_ATE_Q} e ${DE_Q_ATE_R} e vvvvv >`);
    expect(estado.situacao).toBe('vitoria');
    expect(estado.trocas).toBe(3);
    expect(estado.estrelas).toBe(3);
  });

  it('o emissor do laser é sólido', () => {
    // Laser em (1,3): de (2,2) desce para (2,3) e tenta ir para a esquerda.
    const estado = jogar(inicio(), 'v<');
    expect(estado.jogador).toEqual({ x: 2, y: 3 });
    expect(estado.evento).toBe('bloqueado');
  });
});

describe('fase 2-2: ponte (OR) e laser (XOR) dividindo a entrada Q', () => {
  const inicio = () => novoEstado(fase('2-2'));

  it('ligar Q estenderia a ponte, mas liga o laser P ⊕ Q: alarme', () => {
    expect(jogar(inicio(), `${ATE_Q} e`).evento).toBe('alarme');
  });

  it('ligar R estende a ponte sem mexer no laser', () => {
    const estado = jogar(inicio(), `${ATE_R} e`);
    expect(estado.evento).toBe('troca');
    expect(portaAberta(estado, fase('2-2').portas[0]!)).toBe(true);
  });
});

describe('fase 1-2: alerta só para o mínimo de trocas', () => {
  it('limite igual ao mínimo (folga 0): duas trocas desperdiçadas já impedem a solução', () => {
    const f = fase('1-2');
    expect(limiteAlerta(f)).toBe(3);
    const estado = jogar(novoEstado(f), `${ATE_P} eee ${DE_P_ATE_Q} e`);
    expect(estado.evento).toBe('alerta_estourou');
  });
});

describe('caixas e placas de pressão (fase 2-1)', () => {
  // Início (2,2); caixa em (3,3); placa P em (4,3); ponte P ∨ Q em (6,3); porta P ⊕ Q em (9,3);
  // interruptor Q em (3,1).
  const f = fase('2-1');
  const inicio = () => novoEstado(f);
  const [ponte, porta] = [f.portas[0]!, f.portas[1]!];

  it('a placa começa em 0', () => {
    expect(inicio().valoracao).toEqual({ P: 0, Q: 0 });
  });

  it('empurrar a caixa para a placa põe P em 1 sem somar alerta', () => {
    const estado = jogar(inicio(), 'v>');
    expect(estado.caixas).toEqual([{ x: 4, y: 3 }]);
    expect(estado.jogador).toEqual({ x: 3, y: 3 });
    expect(estado.valoracao).toEqual({ P: 1, Q: 0 });
    expect(estado.alerta).toBe(0);
    expect(estado.trocas).toBe(0);
    expect(portaAberta(estado, ponte)).toBe(true);
    expect(portaAberta(estado, porta)).toBe(true);
  });

  it('o jogador sobre a placa também vale 1 — mas só enquanto estiver nela', () => {
    const estado = jogar(inicio(), 'v>>'); // caixa vai para (5,3); o jogador fica em (4,3)
    expect(estado.caixas).toEqual([{ x: 5, y: 3 }]);
    expect(estado.jogador).toEqual({ x: 4, y: 3 });
    expect(estado.valoracao['P']).toBe(1);
    const saiu = jogar(estado, '^');
    expect(saiu.valoracao['P']).toBe(0);
    expect(portaAberta(saiu, ponte)).toBe(false); // a ponte recolhe quando volta a 0
  });

  it('caixa não atravessa parede nem ponte', () => {
    const naParede = jogar(inicio(), '>vvvv'); // de (3,2), empurra a caixa para baixo até (3,5)
    expect(naParede.caixas).toEqual([{ x: 3, y: 5 }]);
    expect(naParede.evento).toBe('bloqueado');
    const naPonte = jogar(inicio(), 'v>>>'); // caixa em (5,3); a ponte em (6,3) não aceita caixa
    expect(naPonte.caixas).toEqual([{ x: 5, y: 3 }]);
    expect(naPonte.evento).toBe('bloqueado');
  });

  it('com a placa e o interruptor Q ligados, o XOR fecha a porta', () => {
    const estado = jogar(inicio(), 'v> ^^ e'); // caixa na placa; sobe até (3,2) e troca Q em (3,1)
    expect(estado.valoracao).toEqual({ P: 1, Q: 1 });
    expect(portaAberta(estado, ponte)).toBe(true);
    expect(portaAberta(estado, porta)).toBe(false);
  });

  it('solução sem nenhuma troca: 3 estrelas', () => {
    const estado = jogar(inicio(), 'v> ^>>v >>>>>>>');
    expect(estado.situacao).toBe('vitoria');
    expect(estado.trocas).toBe(0);
    expect(estado.estrelas).toBe(3);
  });

  it('solução pelo interruptor Q: 1 troca a mais que o mínimo, 2 estrelas', () => {
    const estado = jogar(inicio(), '>^e >>v >>>>>>>');
    expect(estado.situacao).toBe('vitoria');
    expect(estado.trocas).toBe(1);
    expect(estado.estrelas).toBe(2);
  });
});

describe('Scanner (tecla Q)', () => {
  const inicio = () => novoEstado(fase('3-2'));

  it('revela a tabela-verdade do circuito em foco e soma 2 ao alerta', () => {
    const antes = inicio();
    const foco = circuitoEmFoco(antes)!;
    const estado = jogar(antes, 'q');
    expect(estado.escaneados).toEqual([foco.id]);
    expect(estado.alerta).toBe(2);
    expect(estado.trocas).toBe(0); // Scanner não é troca: não tira estrela
    expect(estado.evento).toBe('scanner');
  });

  it('escanear de novo o mesmo circuito não cobra outra vez', () => {
    const estado = jogar(inicio(), 'qq');
    expect(estado.alerta).toBe(2);
    expect(estado.escaneados).toHaveLength(1);
  });

  it('cada circuito é escaneado separadamente', () => {
    // Perto do início o foco é o laser (1,3); perto da porta (9,4), é a porta.
    const estado = jogar(inicio(), 'q v>>>>>>> q');
    expect(estado.escaneados).toEqual(['laser-0', 'porta-0']);
    expect(estado.alerta).toBe(4);
  });

  it('Scanner que estoura o limite de alerta reinicia a fase', () => {
    const f = fase('1-2'); // limite 3
    const estado = jogar(novoEstado(f), `q ${ATE_P} ee`);
    expect(estado.evento).toBe('alerta_estourou');
  });
});

describe('fase 3-1: duas portas ao mesmo tempo (→ e ↔)', () => {
  it('ligar Q abre as duas com uma troca', () => {
    const f = fase('3-1');
    // Início (2,2); Q em (8,1): sobe para (2,1) e anda até (7,1), encostando em Q.
    const estado = jogar(novoEstado(f), '^>>> v>>>^ > e');
    expect(estado.valoracao).toEqual({ P: 1, Q: 1, R: 1 });
    expect(f.portas.every((porta) => portaAberta(estado, porta))).toBe(true);
  });
});
