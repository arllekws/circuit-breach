import { describe, expect, it } from 'vitest';
import { carregarFases } from '../../src/fases/carregar';
import fase41 from '../../src/fases/dados/4-1.json';
import fase42 from '../../src/fases/dados/4-2.json';
import { validarFase } from '../../src/fases/validar';
import { aplicar } from '../../src/jogo/aplicar';
import { montarFormula } from '../../src/jogo/desafios';
import { novoEstado } from '../../src/jogo/estado';
import { limiteAlerta, portaAberta } from '../../src/jogo/regras';
import { tabelaDoScanner } from '../../src/jogo/scanner';
import type { Acao, Estado, Fase } from '../../src/jogo/tipos';
import { formatar } from '../../src/logica/formatar';
import type { ConectivoBinario } from '../../src/logica/tipos';
import { jogar } from '../apoio';

const fases = carregarFases();
const fase = (id: string): Fase => fases.find((f) => f.id === id) as Fase;
const acoes = (estado: Estado, lista: Acao[]): Estado => lista.reduce(aplicar, estado);

describe('fase 4-1: tautologia, contradição e montagem de circuito', () => {
  const f = fase('4-1');
  const [sempreAtivo, corrompido, saida] = [f.portas[0]!, f.portas[1]!, f.portas[2]!];
  // Início (2,2); atravessa a porta sempre ativa (6,2) e encosta no terminal F (10,1).
  const ATE_O_FIREWALL = '>>>>>>> ^ >';
  const noFirewall = () => jogar(novoEstado(f), `${ATE_O_FIREWALL} e`);
  const montar = (portas: ConectivoBinario[]): Acao[] => [
    ...portas.map((porta, espaco): Acao => ({ tipo: 'escolherPorta', espaco, porta })),
    { tipo: 'confirmar' },
  ];

  it('painel sempre ativo (P ∨ ¬P): aberto em qualquer valoração, sem mexer em nada', () => {
    const inicio = novoEstado(f);
    expect(portaAberta(inicio, sempreAtivo)).toBe(true);
    // Encosta em P (4,1) e troca: a porta continua aberta.
    const trocouP = jogar(inicio, '> ^ > e');
    expect(trocouP.valoracao['P']).toBe(1);
    expect(portaAberta(trocouP, sempreAtivo)).toBe(true);
    expect(tabelaDoScanner(sempreAtivo, inicio.valoracao).classificacao).toBe('tautologia');
  });

  it('painel corrompido (Q ∧ ¬Q): nunca abre, com Q em 0 ou em 1', () => {
    const inicio = novoEstado(f);
    expect(portaAberta(inicio, corrompido)).toBe(false);
    // Encosta em Q (1,4) e troca: continua trancada (e o alerta foi gasto à toa).
    const trocouQ = jogar(inicio, 'vv < e');
    expect(trocouQ.valoracao['Q']).toBe(1);
    expect(trocouQ.alerta).toBe(1);
    expect(portaAberta(trocouQ, corrompido)).toBe(false);
    expect(tabelaDoScanner(corrompido, inicio.valoracao).classificacao).toBe('contradicao');
  });

  it('a porta corrompida é opcional: não entra no cálculo de solução', () => {
    expect(corrompido.opcional).toBe(true);
    expect(f.minimo).toBe(0);
    const semOpcional = validarFase({
      ...fase41,
      portas: fase41.portas.map((porta) => ({ ...porta, opcional: false })),
    });
    expect(semOpcional.ok).toBe(false); // se fosse obrigatória, a fase não teria solução
  });

  it('E no terminal abre o desafio; Esc volta ao mapa sem custo', () => {
    const aberto = noFirewall();
    expect(aberto.evento).toBe('desafio_aberto');
    expect(aberto.desafio).toEqual({ tipo: 'montagem', nome: 'F', escolhas: [null, null, null], cursor: 0 });
    const fechado = jogar(aberto, 'p');
    expect(fechado.desafio).toBeNull();
    expect(fechado.alerta).toBe(0);
    expect(fechado.situacao).toBe('jogando');
  });

  it('com o desafio aberto, o jogador não anda no mapa', () => {
    const aberto = noFirewall();
    expect(jogar(aberto, '<<').jogador).toEqual(aberto.jogador);
  });

  it('aceita a montagem do relatório: (A ∨ B) ∧ ¬(A ∧ B)', () => {
    const estado = acoes(noFirewall(), montar(['OR', 'AND', 'AND']));
    expect(estado.evento).toBe('desafio_resolvido');
    expect(estado.valoracao['F']).toBe(1);
    expect(estado.desafio).toBeNull();
    expect(estado.erros).toBe(0);
    expect(portaAberta(estado, saida)).toBe(true);
  });

  it('aceita QUALQUER circuito com a mesma tabela-verdade, não só um desenho', () => {
    const tentar = (portas: ConectivoBinario[]) => acoes(noFirewall(), montar(portas)).evento;
    expect(tentar(['OR', 'AND', 'AND'])).toBe('desafio_resolvido'); //  (A ∨ B) ∧ ¬(A ∧ B)
    expect(tentar(['XOR', 'AND', 'AND'])).toBe('desafio_resolvido'); // (A ⊕ B) ∧ ¬(A ∧ B)
    expect(tentar(['OR', 'OR', 'AND'])).toBe('erro'); //                (A ∨ B) ∨ ¬(A ∧ B) é tautologia
  });

  it('recusa circuito não equivalente: soma 1 ao alerta e conta como erro', () => {
    const estado = acoes(noFirewall(), montar(['AND', 'AND', 'AND'])); // contradição
    expect(estado.evento).toBe('erro');
    expect(estado.alerta).toBe(1);
    expect(estado.erros).toBe(1);
    expect(estado.valoracao['F']).toBe(0);
    expect(estado.desafio).not.toBeNull(); // continua no desafio para tentar de novo
  });

  it('não confirma com espaço vazio', () => {
    const estado = acoes(noFirewall(), [{ tipo: 'escolherPorta', espaco: 0, porta: 'OR' }, { tipo: 'confirmar' }]);
    expect(estado.evento).toBe('bloqueado');
    expect(estado.alerta).toBe(0);
  });

  it('pelo teclado: setas escolhem o espaço e giram a porta; Enter confirma', () => {
    // Opções [AND, OR, XOR]: "vv" = OR no espaço 1; ">v" = AND no 2; ">v" = AND no 3.
    const estado = jogar(noFirewall(), 'vv >v >v c');
    expect(estado.evento).toBe('desafio_resolvido');
  });

  it('montarFormula encaixa as portas nos espaços', () => {
    const montada = montarFormula('(A ?1 B) ?2 NOT (A ?3 B)', ['OR', 'AND', 'AND']);
    expect(montada && formatar(montada)).toBe('(A ∨ B) ∧ ¬(A ∧ B)');
    expect(montarFormula('A ?1 B', [null])).toBeNull();
    expect(montarFormula('A ?1 B', ['IMP'])).toEqual({
      tipo: 'IMP',
      a: { tipo: 'VAR', nome: 'A' },
      b: { tipo: 'VAR', nome: 'B' },
    });
  });

  it('fase completa sem erros e sem trocas: 3 estrelas; terminal resolvido não reabre', () => {
    const resolvido = acoes(noFirewall(), montar(['OR', 'AND', 'AND']));
    expect(jogar(resolvido, 'e').desafio).toBeNull();
    // De (9,1) desce pela porta de saída (9,5) até (9,7) e vai à saída (10,7).
    const fim = jogar(resolvido, 'vvvvvv >');
    expect(fim.situacao).toBe('vitoria');
    expect(fim.estrelas).toBe(3);
  });

  it('um erro no desafio custa estrela', () => {
    const comErro = acoes(noFirewall(), [...montar(['AND', 'AND', 'AND']), ...montar(['OR', 'AND', 'AND'])]);
    expect(comErro.erros).toBe(1);
    expect(jogar(comErro, 'vvvvvv >').estrelas).toBe(2);
  });
});

describe('fase 4-2: firewall espelhado (equivalências)', () => {
  const f = fase('4-2');
  // Início (2,2); terminal F em (6,1): sobe e anda até encostar.
  const noFirewall = () => jogar(novoEstado(f), '^ >>> e');
  const cabo = (indice: number): Acao => ({ tipo: 'escolherCabo', indice });
  // Cabos certos: De Morgan (2º), dupla negação (1º), P → Q ≡ ¬P ∨ Q (2º), De Morgan (1º).
  const CERTOS = [1, 0, 1, 0];

  it('abre na primeira rodada', () => {
    expect(noFirewall().desafio).toEqual({ tipo: 'espelho', nome: 'F', rodada: 0, cursor: 0 });
  });

  it('cabo equivalente avança de rodada', () => {
    const estado = aplicar(noFirewall(), cabo(1)); // ¬(P ∧ Q) ≡ ¬P ∨ ¬Q
    expect(estado.evento).toBe('desafio_avancou');
    expect(estado.desafio).toMatchObject({ rodada: 1 });
    expect(estado.alerta).toBe(0);
  });

  it('cabo não equivalente dispara o alarme: +1 alerta, erro, e volta à primeira rodada', () => {
    const naSegunda = aplicar(noFirewall(), cabo(1));
    const errou = aplicar(naSegunda, cabo(1)); // ¬¬P não é equivalente a ¬P
    expect(errou.evento).toBe('erro');
    expect(errou.alerta).toBe(1);
    expect(errou.erros).toBe(1);
    expect(errou.desafio).toMatchObject({ rodada: 0 });
  });

  it('acertar as 4 rodadas (De Morgan, dupla negação, implicação, De Morgan) libera a porta', () => {
    const estado = acoes(noFirewall(), CERTOS.map(cabo));
    expect(estado.evento).toBe('desafio_resolvido');
    expect(estado.valoracao['F']).toBe(1);
    expect(portaAberta(estado, f.portas[0]!)).toBe(true);
  });

  it('pelo teclado: setas escolhem o cabo, Enter liga', () => {
    const estado = jogar(noFirewall(), '>c c >c c');
    expect(estado.evento).toBe('desafio_resolvido');
  });

  it('errar mais vezes que o limite de alerta reinicia a fase', () => {
    const limite = limiteAlerta(f);
    const erradas = Array.from({ length: limite + 1 }, () => cabo(0)); // 1º cabo da rodada 1 é o errado
    const estado = acoes(noFirewall(), erradas);
    expect(estado.evento).toBe('alerta_estourou');
    expect(estado.desafio).toBeNull();
    expect(estado.jogador).toEqual(f.inicio);
  });

  it('o validador exige exatamente um cabo equivalente por rodada', () => {
    const comDoisCertos = validarFase({
      ...fase42,
      desafios: [{ ...fase42.desafios[0], rodadas: [{ original: 'P', cabos: ['NOT NOT P', 'P AND P'] }] }],
    });
    expect(comDoisCertos.ok).toBe(false);
    if (!comDoisCertos.ok) expect(comDoisCertos.erros.join()).toMatch(/2 cabos equivalentes/);

    const semCerto = validarFase({
      ...fase42,
      desafios: [{ ...fase42.desafios[0], rodadas: [{ original: 'P', cabos: ['NOT P', 'Q'] }] }],
    });
    expect(semCerto.ok).toBe(false);
  });

  it('o validador recusa montagem impossível ou trivial', () => {
    const desafio = fase41.desafios[0]!;
    // Nenhuma montagem do molde depende de C: o alvo é inalcançável.
    const impossivel = validarFase({ ...fase41, desafios: [{ ...desafio, alvo: 'A AND C' }] });
    expect(impossivel.ok).toBe(false);
    const semEspaco = validarFase({ ...fase41, desafios: [{ ...desafio, molde: 'A XOR B' }] });
    expect(semEspaco.ok).toBe(false);
  });
});
