import { describe, expect, it } from 'vitest';
import fase11 from '../../src/fases/dados/1-1.json';
import { validarFase } from '../../src/fases/validar';

/** Erros de validação da fase 1-1 com alguns campos trocados. */
function errosCom(mudancas: Record<string, unknown>): string {
  const resultado = validarFase({ ...fase11, ...mudancas });
  return resultado.ok ? '' : resultado.erros.join('\n');
}

describe('validarFase — fase válida', () => {
  it('aceita a fase 1-1 e calcula o mínimo de trocas (2) pela tabela-verdade', () => {
    const resultado = validarFase(fase11);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fase.minimo).toBe(2);
    expect(resultado.fase.entradas).toEqual({ P: 1, Q: 0 });
    expect(resultado.fase.inicio).toEqual({ x: 2, y: 3 });
    expect(resultado.fase.saida).toEqual({ x: 10, y: 7 });
    expect(resultado.fase.portas[0]?.tipo).toBe('porta');
    expect(resultado.avisos).toEqual([]);
  });
});

describe('validarFase — formato', () => {
  it('recusa o que não é objeto', () => {
    expect(validarFase(null).ok).toBe(false);
    expect(validarFase([]).ok).toBe(false);
  });

  it('exige id, setor e título', () => {
    expect(errosCom({ id: '' })).toMatch(/"id"/);
    expect(errosCom({ setor: undefined })).toMatch(/"setor"/);
  });

  it('exige mapa retangular, com um início e uma saída', () => {
    expect(errosCom({ mapa: ['#####', '#@X#'] })).toMatch(/largura diferente/);
    expect(errosCom({ mapa: ['####', '#.X#', '####'] })).toMatch(/início/);
    expect(errosCom({ mapa: ['####', '#@.#', '####'] })).toMatch(/saída/);
    expect(errosCom({ mapa: ['#####', '#@?X#', '#####'] })).toMatch(/desconhecido "\?"/);
  });

  it('limita o tamanho do mapa ao que cabe na tela', () => {
    expect(errosCom({ mapa: ['#'.repeat(14)] })).toMatch(/13×11/);
  });

  it('entradas só podem valer 0 ou 1', () => {
    expect(errosCom({ entradas: { P: 2, Q: 0 } })).toMatch(/P deve valer 0 ou 1/);
  });

  it('elementos precisam estar sobre o chão e não podem se sobrepor', () => {
    expect(errosCom({ interruptores: [{ nome: 'P', em: [0, 0] }, { nome: 'Q', em: [8, 1] }] })).toMatch(
      /não está sobre o chão/,
    );
    expect(errosCom({ interruptores: [{ nome: 'P', em: [8, 1] }, { nome: 'Q', em: [8, 1] }] })).toMatch(
      /Mais de um elemento/,
    );
  });

  it('toda proposição precisa de um interruptor no mapa', () => {
    expect(errosCom({ interruptores: [{ nome: 'P', em: [4, 1] }] })).toMatch(/Q não tem interruptor/);
  });

  it('folga de alerta precisa ser inteiro não negativo', () => {
    expect(errosCom({ folga_alerta: -1 })).toMatch(/folga_alerta/);
    expect(errosCom({ folga_alerta: undefined })).toMatch(/folga_alerta/);
  });
});

describe('validarFase — lógica (gerador de tabela-verdade)', () => {
  it('fórmula mal formada gera erro legível, com a mensagem do parser', () => {
    const erros = errosCom({ portas: [{ em: [6, 5], formula: 'NOT P AND' }] });
    expect(erros).toMatch(/Fórmula inválida/);
    expect(erros).toMatch(/terminou/);
  });

  it('fórmula não pode usar proposição que não está nas entradas', () => {
    expect(errosCom({ portas: [{ em: [6, 5], formula: 'P AND R' }] })).toMatch(/usa R/);
  });

  it('recusa fase sem solução (porta com contradição)', () => {
    expect(errosCom({ portas: [{ em: [6, 5], formula: 'Q AND NOT Q' }] })).toMatch(/não tem solução/);
  });

  it('recusa fase em que um laser já começa ligado', () => {
    expect(errosCom({ lasers: [{ em: [3, 6], formula: 'P' }] })).toMatch(/já começa ligado/);
  });

  it('recusa fase cuja solução só é alcançável passando por um laser', () => {
    const erros = errosCom({
      entradas: { P: 0, Q: 0 },
      portas: [{ em: [6, 5], formula: 'P AND Q' }],
      lasers: [{ em: [3, 6], formula: 'P XOR Q' }],
    });
    expect(erros).toMatch(/evite disparar um laser/);
  });

  it('avisa quando a ordem das trocas obriga um desvio (mínimo seguro > Hamming)', () => {
    const resultado = validarFase({
      ...fase11,
      mapa: fase11.mapa.map((linha, y) => (y === 3 ? '#.@.........#' : linha)),
      entradas: { P: 0, Q: 0, R: 1 },
      interruptores: [...fase11.interruptores, { nome: 'R', em: [10, 1] }],
      portas: [{ em: [6, 5], formula: 'P AND Q' }],
      lasers: [{ em: [3, 6], formula: '(P XOR Q) AND R' }],
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fase.minimo).toBe(3);
    expect(resultado.avisos.join()).toMatch(/Hamming/);
  });
});
