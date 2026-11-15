import { describe, expect, it } from 'vitest';
import { carregarFases } from '../../src/fases/carregar';
import fase51 from '../../src/fases/dados/5-1.json';
import fase52 from '../../src/fases/dados/5-2.json';
import { validarFase } from '../../src/fases/validar';
import { aplicar } from '../../src/jogo/aplicar';
import { botoesDeRegra, type EstadoDoDesafio, type Prova } from '../../src/jogo/desafios';
import { novoEstado } from '../../src/jogo/estado';
import { limiteAlerta, portaAberta } from '../../src/jogo/regras';
import type { Acao, Estado, Fase } from '../../src/jogo/tipos';
import { formatar } from '../../src/logica/formatar';
import type { Bit } from '../../src/logica/tipos';
import { BOTAO, jogar, ROTEIROS_DE_PROVA } from '../apoio';

const fases = carregarFases();
const fase = (id: string): Fase => fases.find((f) => f.id === id) as Fase;
const acoes = (estado: Estado, lista: Acao[]): Estado => lista.reduce(aplicar, estado);

describe('fase 5-1: terminais confiáveis e comprometidos', () => {
  const f = fase('5-1');
  // Início (2,2); terminal T em (5,1): sobe e anda até encostar. U fica em (9,1).
  const emT = () => jogar(novoEstado(f), '^ >> e');
  const marcar = (...valores: Bit[]): Acao[] => [
    ...valores.map((valor, indice): Acao => ({ tipo: 'marcar', indice, valor })),
    { tipo: 'confirmar' },
  ];

  it('abre com os terminais ainda sem marca', () => {
    expect(emT().desafio).toEqual({ tipo: 'terminais', nome: 'T', marcas: [null, null], cursor: 0 });
  });

  it('exemplo do relatório: A confiável e B comprometido satisfaz A ↔ ¬B e B ↔ (A ↔ B)', () => {
    const estado = acoes(emT(), marcar(1, 0));
    expect(estado.evento).toBe('desafio_resolvido');
    expect(estado.valoracao['T']).toBe(1);
    expect(estado.erros).toBe(0);
  });

  it('as outras três marcações são recusadas (somam alerta e erro)', () => {
    for (const [a, b] of [[0, 0], [0, 1], [1, 1]] as [Bit, Bit][]) {
      const estado = acoes(emT(), marcar(a, b));
      expect(estado.evento, `A=${a} B=${b}`).toBe('erro');
      expect(estado.alerta).toBe(1);
      expect(estado.erros).toBe(1);
      expect(estado.valoracao['T']).toBe(0);
    }
  });

  it('não confere enquanto houver terminal sem marca', () => {
    const estado = acoes(emT(), [{ tipo: 'marcar', indice: 0, valor: 1 }, { tipo: 'confirmar' }]);
    expect(estado.evento).toBe('bloqueado');
    expect(estado.alerta).toBe(0);
  });

  it('pelo teclado: ↑ confiável, ↓ comprometido, ←→ muda de terminal, Enter confere', () => {
    const estado = jogar(emT(), '^ > v c');
    expect(estado.evento).toBe('desafio_resolvido');
  });

  it('segundo enigma (3 terminais): só A comprometido, B confiável, C comprometido serve', () => {
    // Depois de T, anda até U (9,1): de (4,1) desce, anda e sobe até (8,1).
    const emU = jogar(acoes(emT(), marcar(1, 0)), 'v >>>> ^ > e');
    expect(emU.desafio).toMatchObject({ tipo: 'terminais', nome: 'U' });
    expect(acoes(emU, marcar(1, 0, 1)).evento).toBe('erro');
    const resolvido = acoes(emU, marcar(0, 1, 0));
    expect(resolvido.evento).toBe('desafio_resolvido');
    // Com T e U em 1, a porta T ∧ U abre.
    expect(portaAberta(resolvido, f.portas[0]!)).toBe(true);
  });

  it('o validador exige enigma com solução única e fórmulas na forma A ↔ φ', () => {
    const desafio = fase51.desafios[0]!;
    const ambiguo = validarFase({
      ...fase51,
      desafios: [{ ...desafio, terminais: [desafio.terminais[0], { nome: 'B', fala: '…', formula: 'B <-> B' }] }],
    });
    expect(ambiguo.ok).toBe(false);
    if (!ambiguo.ok) expect(ambiguo.erros.join()).toMatch(/2 soluções/);

    const semForma = validarFase({
      ...fase51,
      desafios: [{ ...desafio, terminais: [desafio.terminais[0], { nome: 'B', fala: '…', formula: 'A AND B' }] }],
    });
    expect(semForma.ok).toBe(false);
    if (!semForma.ok) expect(semForma.erros.join()).toMatch(/B <-> /);
  });
});

describe('fase 5-2: Núcleo Central (regras de inferência)', () => {
  const f = fase('5-2');
  const definicao = f.desafios[0]!.desafio as Prova;
  // Início (2,2); terminal N em (6,1).
  const noNucleo = () => jogar(novoEstado(f), '^ >>> e');
  const marcar = (...indices: number[]): Acao[] => indices.map((indice) => ({ tipo: 'selecionar', indice }));
  const regra = (botao: number): Acao => ({ tipo: 'aplicarRegra', botao });
  const prova = (estado: Estado) => estado.desafio as Extract<EstadoDoDesafio, { tipo: 'prova' }>;
  const linhas = (estado: Estado) => prova(estado).linhas.map((l) => `${formatar(l.formula)} — ${l.justificativa}`);

  it('abre com os logs do sistema como premissas numeradas', () => {
    expect(linhas(noNucleo())).toEqual(['P → Q — premissa', 'Q → R — premissa', '¬R — premissa']);
    expect(formatar(definicao.rodadas[0]!.meta)).toBe('¬P');
  });

  it('oferece as 7 regras do relatório', () => {
    const regras = new Set(botoesDeRegra(definicao.rodadas[0]!).map((b) => b.regra));
    expect([...regras].sort()).toEqual(['AD', 'CONJ', 'MP', 'MT', 'SD', 'SH', 'SIMP']);
  });

  it('exemplo do relatório: SH (1, 2) acrescenta a linha 4, P → R', () => {
    const estado = acoes(noNucleo(), [...marcar(0, 1), regra(BOTAO.SH)]);
    expect(estado.evento).toBe('desafio_avancou');
    expect(linhas(estado)[3]).toBe('P → R — Silogismo Hipotético (1, 2)');
    expect(prova(estado).selecionadas).toEqual([]);
    expect(estado.alerta).toBe(0);
  });

  it('MT (4, 3) chega a ¬P e a primeira prova termina', () => {
    const estado = acoes(noNucleo(), [...marcar(0, 1), regra(BOTAO.SH), ...marcar(3, 2), regra(BOTAO.MT)]);
    expect(estado.evento).toBe('desafio_avancou');
    expect(prova(estado).rodada).toBe(1); // passou para a segunda prova
    expect(linhas(estado)).toHaveLength(3);
  });

  it('caminho alternativo também vale: MT (2, 3) dá ¬Q; MT (1, 4) dá ¬P', () => {
    const estado = acoes(noNucleo(), [...marcar(1, 2), regra(BOTAO.MT), ...marcar(0, 3), regra(BOTAO.MT)]);
    expect(prova(estado).rodada).toBe(1);
    expect(estado.erros).toBe(0);
  });

  it('passo inválido é recusado: não entra na prova, soma alerta e explica o motivo', () => {
    const estado = acoes(noNucleo(), [...marcar(0, 2), regra(BOTAO.MP)]); // MP em P → Q e ¬R
    expect(estado.evento).toBe('erro');
    expect(estado.alerta).toBe(1);
    expect(estado.erros).toBe(1);
    expect(linhas(estado)).toHaveLength(3);
    expect(prova(estado).recusa).toMatch(/Modus Ponens não se aplica/);
  });

  it('falácia da afirmação do consequente é recusada', () => {
    // Na prova 3 há P, Q e (P ∧ Q) → R. Tentar MT com a implicação e Q não casa com o esquema.
    const naTerceira = acoes(noNucleo(), ROTEIROS_DE_PROVA['5-2:N']!.slice(0, 14));
    expect(prova(naTerceira).rodada).toBe(2);
    expect(acoes(naTerceira, [...marcar(2, 1), regra(BOTAO.MT)]).evento).toBe('erro');
  });

  it('regra com número errado de linhas é recusada', () => {
    expect(acoes(noNucleo(), [...marcar(0), regra(BOTAO.SH)]).evento).toBe('erro');
  });

  it('marcar uma terceira linha desmarca a mais antiga; marcar de novo desmarca', () => {
    const tres = acoes(noNucleo(), marcar(0, 1, 2));
    expect(prova(tres).selecionadas).toEqual([1, 2]);
    expect(prova(acoes(tres, marcar(1))).selecionadas).toEqual([2]);
  });

  it('não repete linha que já está na prova (sem custo)', () => {
    const estado = acoes(noNucleo(), [...marcar(0, 1), regra(BOTAO.SH), ...marcar(0, 1), regra(BOTAO.SH)]);
    expect(estado.evento).toBe('bloqueado');
    expect(estado.alerta).toBe(0);
    expect(linhas(estado)).toHaveLength(4);
  });

  it('pelo teclado: ↑↓ linha, E marca, ←→ regra, Enter aplica', () => {
    // Marca as linhas 1 e 2, leva o cursor de regra até SH (3º botão) e aplica.
    const estado = jogar(noNucleo(), 'e v e >> c');
    expect(linhas(estado)[3]).toBe('P → R — Silogismo Hipotético (1, 2)');
  });

  it('as três provas juntas usam as 7 regras e desligam o Núcleo', () => {
    const estado = acoes(noNucleo(), ROTEIROS_DE_PROVA['5-2:N']!);
    expect(estado.evento).toBe('desafio_resolvido');
    expect(estado.valoracao['N']).toBe(1);
    expect(estado.erros).toBe(0);
    // De (5,1), contorna o terminal e desce pela porta N (9,4) até a saída (10,6).
    const fim = jogar(estado, 'v >>>> vvvv >');
    expect(fim.situacao).toBe('vitoria');
    expect(fim.estrelas).toBe(3);
  });

  it('errar mais passos que o limite de alerta reinicia a fase', () => {
    const invalido = [...marcar(0, 2), regra(BOTAO.MP)];
    const muitas = Array.from({ length: limiteAlerta(f) + 1 }, () => invalido).flat();
    expect(acoes(noNucleo(), muitas).evento).toBe('alerta_estourou');
  });

  it('o validador recusa prova cuja meta não segue das premissas, ou com premissas contraditórias', () => {
    const desafio = fase52.desafios[0]!;
    const rodada = desafio.rodadas[0]!;
    const naoSegue = validarFase({ ...fase52, desafios: [{ ...desafio, rodadas: [{ ...rodada, meta: 'P' }] }] });
    expect(naoSegue.ok).toBe(false);
    if (!naoSegue.ok) expect(naoSegue.erros.join()).toMatch(/não é consequência lógica/);

    const contraditoria = validarFase({
      ...fase52,
      desafios: [{ ...desafio, rodadas: [{ ...rodada, premissas: [...rodada.premissas, { formula: 'R', log: '' }] }] }],
    });
    expect(contraditoria.ok).toBe(false);
    if (!contraditoria.ok) expect(contraditoria.erros.join()).toMatch(/contraditórias/);
  });
});
