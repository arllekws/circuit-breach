import { describe, expect, it } from 'vitest';
import {
  distanciaDeHamming,
  minimoTrocas,
  minimoTrocasSeguro,
} from '../../src/logica/minimoTrocas';
import { analisar } from '../../src/logica/parser';
import {
  satisfativel,
  satisfaz,
  solucoes,
  type Restricoes,
} from '../../src/logica/satisfatibilidade';

const restricoes = (portas: string[], lasers: string[] = []): Restricoes => ({
  devemSer1: portas.map(analisar),
  devemSer0: lasers.map(analisar),
});

describe('satisfatibilidade', () => {
  it('fase 1-1: ¬P ∧ Q tem uma única solução, P=0 Q=1', () => {
    expect(solucoes(restricoes(['NOT P AND Q']))).toEqual([{ P: 0, Q: 1 }]);
  });

  it('fase 3-2: porta (P → Q) ∧ R em 1 e laser Q ∧ R em 0 — única solução P=0 Q=0 R=1', () => {
    const fase = restricoes(['(P -> Q) AND R'], ['Q AND R']);
    expect(solucoes(fase)).toEqual([{ P: 0, Q: 0, R: 1 }]);
    expect(satisfativel(fase)).toBe(true);
  });

  it('satisfaz confere porta e laser ao mesmo tempo', () => {
    const fase = restricoes(['(P -> Q) AND R'], ['Q AND R']);
    expect(satisfaz(fase, { P: 0, Q: 0, R: 1 })).toBe(true);
    expect(satisfaz(fase, { P: 1, Q: 1, R: 1 })).toBe(false); // porta abre, mas o laser liga
    expect(satisfaz(fase, { P: 1, Q: 1, R: 0 })).toBe(false); // laser desligado, porta fechada
  });

  it('condições impossíveis não têm solução', () => {
    expect(solucoes(restricoes(['P AND Q'], ['P']))).toEqual([]);
    expect(satisfativel(restricoes(['Q AND NOT Q']))).toBe(false);
    expect(satisfativel(restricoes(['P'], ['P OR NOT P']))).toBe(false);
  });

  it('fase 5-1 (terminais): A ↔ ¬B e B ↔ (A ↔ B) — A confiável, B comprometido', () => {
    expect(solucoes(restricoes(['A <-> NOT B', 'B <-> (A <-> B)']))).toEqual([{ A: 1, B: 0 }]);
  });
});

describe('distanciaDeHamming', () => {
  it('conta as proposições em que as valorações diferem', () => {
    expect(distanciaDeHamming({ P: 1, Q: 0 }, { P: 0, Q: 1 })).toBe(2);
    expect(distanciaDeHamming({ P: 1, Q: 0 }, { P: 1, Q: 0 })).toBe(0);
    expect(distanciaDeHamming({ P: 1, Q: 1, R: 0 }, { P: 0, Q: 0, R: 1 })).toBe(3);
    expect(distanciaDeHamming({ P: 1, Q: 0 }, { P: 0, Q: 1 }, ['Q'])).toBe(1);
  });
});

describe('minimoTrocas — menor distância de Hamming até uma solução', () => {
  it('fase 1-1: de P=1 Q=0, mínimo de 2 trocas', () => {
    const minimo = minimoTrocas({ P: 1, Q: 0 }, restricoes(['NOT P AND Q']));
    expect(minimo).toEqual({ trocas: 2, alvo: { P: 0, Q: 1 } });
  });

  it('fase 3-2: de P=1 Q=1 R=0, mínimo de 3 trocas', () => {
    const minimo = minimoTrocas(
      { P: 1, Q: 1, R: 0 },
      restricoes(['(P -> Q) AND R'], ['Q AND R']),
    );
    expect(minimo).toEqual({ trocas: 3, alvo: { P: 0, Q: 0, R: 1 } });
  });

  it('escolhe a solução mais próxima quando há várias', () => {
    // P ∨ Q a partir de 00: basta ligar um dos dois.
    expect(minimoTrocas({ P: 0, Q: 0 }, restricoes(['P OR Q']))?.trocas).toBe(1);
    // Já resolvida: zero trocas.
    expect(minimoTrocas({ P: 1, Q: 0 }, restricoes(['P OR Q']))?.trocas).toBe(0);
  });

  it('fase sem solução devolve null', () => {
    expect(minimoTrocas({ Q: 0 }, restricoes(['Q AND NOT Q']))).toBeNull();
  });

  it('proposições livres (placas de pressão) não contam como troca', () => {
    // Ponte P ∨ Q com P = placa: pisar na placa resolve sem trocar interruptor.
    expect(minimoTrocas({ P: 0, Q: 0 }, restricoes(['P OR Q']), ['P'])?.trocas).toBe(0);
    expect(minimoTrocas({ P: 0, Q: 0 }, restricoes(['P AND Q']), ['P'])?.trocas).toBe(1);
  });
});

describe('minimoTrocasSeguro — a ordem importa por causa do laser', () => {
  it('fase 1-1: sem laser, coincide com o mínimo de Hamming', () => {
    expect(minimoTrocasSeguro({ P: 1, Q: 0 }, restricoes(['NOT P AND Q']))?.trocas).toBe(2);
  });

  it('fase 3-2: 3 trocas, e nunca liga R antes de desligar Q', () => {
    const caminho = minimoTrocasSeguro(
      { P: 1, Q: 1, R: 0 },
      restricoes(['(P -> Q) AND R'], ['Q AND R']),
    );
    expect(caminho?.trocas).toBe(3);
    expect(caminho?.alvo).toEqual({ P: 0, Q: 0, R: 1 });
    const ordem = caminho?.ordem ?? [];
    expect([...ordem].sort()).toEqual(['P', 'Q', 'R']);
    expect(ordem.indexOf('Q')).toBeLessThan(ordem.indexOf('R'));
  });

  it('pode ser maior que o mínimo de Hamming quando o caminho direto passa por um laser', () => {
    // Alvo P=Q=1; laser (P ⊕ Q) ∧ R armado: qualquer troca isolada de P ou Q dispara.
    const fase = restricoes(['P AND Q'], ['(P XOR Q) AND R']);
    const inicial = { P: 0, Q: 0, R: 1 } as const;
    expect(minimoTrocas(inicial, fase)?.trocas).toBe(2);
    const seguro = minimoTrocasSeguro(inicial, fase);
    expect(seguro?.trocas).toBe(3);
    expect(seguro?.ordem[0]).toBe('R'); // primeiro desarma o laser
  });

  it('devolve null quando não há caminho seguro', () => {
    // De 00 até 11, com laser P ⊕ Q: toda troca isolada liga o laser.
    const fase = restricoes(['P AND Q'], ['P XOR Q']);
    expect(minimoTrocas({ P: 0, Q: 0 }, fase)?.trocas).toBe(2); // Hamming acha solução…
    expect(minimoTrocasSeguro({ P: 0, Q: 0 }, fase)).toBeNull(); // …mas ela é inalcançável
  });

  it('devolve null se a fase já começa com um laser ligado', () => {
    expect(minimoTrocasSeguro({ P: 1 }, restricoes([], ['P']))).toBeNull();
  });

  it('proposições livres não custam troca', () => {
    const caminho = minimoTrocasSeguro({ P: 0, Q: 0 }, restricoes(['P AND Q']), ['P']);
    expect(caminho?.trocas).toBe(1);
  });
});
