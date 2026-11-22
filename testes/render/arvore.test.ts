import { describe, expect, it } from 'vitest';
import { novoEstado } from '../../src/jogo/estado';
import {
  carregarEstatisticas,
  registrarResultado,
  salvarEstatisticas,
  type Armazenamento,
} from '../../src/jogo/progresso';
import { avancarTutorial, novoTutorial, passoAtual } from '../../src/jogo/tutorial';
import type { Estado, Evento } from '../../src/jogo/tipos';
import { analisar } from '../../src/logica/parser';
import { altura, arvoreAvaliada, arvoreDoMolde, folhas } from '../../src/render/arvore';
import fase11 from '../../src/fases/dados/1-1.json';
import { faseDe } from '../apoio';

describe('arvoreAvaliada (painel do circuito)', () => {
  it('fase 1-1: cada porta lógica traz o próprio resultado', () => {
    expect(arvoreAvaliada(analisar('NOT P AND Q'), { P: 1, Q: 0 })).toEqual({
      op: 'and',
      v: 0,
      a: [{ op: 'not', v: 0, a: [{ in: 'P', v: 1 }] }, { in: 'Q', v: 0 }],
    });
  });

  it('fórmula que é só uma proposição vira uma entrada', () => {
    expect(arvoreAvaliada(analisar('F'), { F: 1 })).toEqual({ in: 'F', v: 1 });
  });

  it('altura e folhas', () => {
    const arvore = arvoreAvaliada(analisar('(P -> Q) AND R'), { P: 1, Q: 1, R: 0 });
    expect(altura(arvore)).toBe(2);
    expect(folhas(arvore)).toBe(3);
  });
});

describe('arvoreDoMolde (Firewall de montagem)', () => {
  const MOLDE = '(A ?1 B) ?2 NOT (A ?3 B)';

  it('espaços vazios viram "?" e contaminam quem depende deles', () => {
    const arvore = arvoreDoMolde(MOLDE, ['OR', null, null], { A: 0, B: 1 }, 1);
    expect(arvore).toMatchObject({
      op: 'unk',
      v: '?',
      sel: true,
      a: [{ op: 'or', v: 1, sel: false }, { op: 'not', v: '?', a: [{ op: 'unk', v: '?', sel: false }] }],
    });
  });

  it('com todos os espaços preenchidos, avalia como a fórmula montada', () => {
    const arvore = arvoreDoMolde(MOLDE, ['OR', 'AND', 'AND'], { A: 0, B: 1 }, 2);
    expect(arvore.v).toBe(1);
    expect(arvore).toMatchObject({ op: 'and', a: [{ op: 'or' }, { op: 'not', a: [{ op: 'and', sel: true }] }] });
  });

  it('respeita conectivos fixos do molde, na ordem do texto', () => {
    const arvore = arvoreDoMolde('(A AND B) ?1 C', ['OR'], { A: 1, B: 1, C: 0 }, 0);
    expect(arvore).toMatchObject({ op: 'or', v: 1, sel: true, a: [{ op: 'and', sel: false }, { in: 'C' }] });
  });
});

describe('tutorial da fase 1-1', () => {
  const fase = faseDe(fase11);
  const com = (evento: Evento, trocas = 0): Estado => ({ ...novoEstado(fase), evento, trocas });

  it('avança passo a passo conforme o que o jogador faz', () => {
    let t = novoTutorial();
    expect(passoAtual(t)).toBe(1);
    t = avancarTutorial(t, com('andou'));
    expect(passoAtual(t)).toBe(2);
    t = avancarTutorial(t, com('troca', 1));
    expect(passoAtual(t)).toBe(3);
    t = avancarTutorial(t, com('andou', 1));
    expect(passoAtual(t)).toBe(4);
    t = avancarTutorial(t, com('troca', 2));
    expect(passoAtual(t)).toBe(5);
    t = avancarTutorial(t, com('scanner', 2));
    expect(passoAtual(t)).toBe(6);
    t = avancarTutorial(t, com('vitoria', 2));
    expect(passoAtual(t)).toBe(7);
  });

  it('"ler" só conta depois de alguma troca, e "observar" só depois de ler', () => {
    let t = avancarTutorial(novoTutorial(), com('andou'));
    t = avancarTutorial(t, com('andou'));
    expect(t[2]).toBe(false);
    t = avancarTutorial(t, com('troca', 1));
    expect(t[3]).toBe(false); // a primeira troca ainda não é "observar"
  });

  it('usar o Scanner antes da hora também conta', () => {
    const t = avancarTutorial(novoTutorial(), com('scanner'));
    expect(t[4]).toBe(true);
    expect(passoAtual(t)).toBe(1);
  });
});

describe('estatísticas para a tela final', () => {
  const falso = (): Armazenamento => {
    const dados: Record<string, string> = {};
    return { getItem: (k) => dados[k] ?? null, setItem: (k, v) => void (dados[k] = v) };
  };
  const resultado = (estrelas: number, trocas: number) => ({ estrelas, trocas, minimo: 2, alerta: trocas, erros: 0 });

  it('guarda o melhor resultado: mais estrelas e, no empate, menos trocas', () => {
    let e = registrarResultado({}, '1-1', resultado(2, 4));
    e = registrarResultado(e, '1-1', resultado(1, 2));
    expect(e['1-1']?.estrelas).toBe(2);
    e = registrarResultado(e, '1-1', resultado(2, 3));
    expect(e['1-1']?.trocas).toBe(3);
    e = registrarResultado(e, '1-1', resultado(3, 5));
    expect(e['1-1']?.estrelas).toBe(3);
  });

  it('salva, carrega e ignora dados corrompidos', () => {
    const armazenamento = falso();
    salvarEstatisticas(armazenamento, { '1-1': resultado(3, 2) });
    expect(carregarEstatisticas(armazenamento)).toEqual({ '1-1': resultado(3, 2) });
    armazenamento.setItem('circuit-breach:estatisticas:v1', '{"1-1":{"estrelas":"x"}}');
    expect(carregarEstatisticas(armazenamento)).toEqual({});
  });
});
