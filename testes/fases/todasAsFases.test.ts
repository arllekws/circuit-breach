import { describe, expect, it } from 'vitest';
import { carregarFases } from '../../src/fases/carregar';
import { validarFase } from '../../src/fases/validar';
import { limiteAlerta } from '../../src/jogo/regras';
import { resolver } from '../apoio';

// Toda fase passa pelo gerador de tabela-verdade antes de entrar no jogo — e este teste
// percorre TODOS os JSON de src/fases/dados para garantir isso.

const arquivos = import.meta.glob<unknown>('../../src/fases/dados/*.json', {
  eager: true,
  import: 'default',
});
const fases = carregarFases();

/** Mínimo de trocas esperado em cada fase (conferido à mão; o validador calcula sozinho). */
const MINIMO_ESPERADO: Record<string, number> = {
  '1-1': 2,
  '1-2': 3,
  '2-1': 0,
  '2-2': 1,
  '3-1': 1,
  '3-2': 3,
  '4-1': 0,
  '4-2': 0,
};

describe('todas as fases', () => {
  it('carrega todas, em ordem', () => {
    expect(fases.map((f) => f.id)).toEqual(Object.keys(MINIMO_ESPERADO));
    expect(Object.keys(arquivos)).toHaveLength(fases.length);
  });

  it('nenhuma fase gera avisos do validador', () => {
    for (const json of Object.values(arquivos)) {
      const resultado = validarFase(json);
      expect(resultado.ok && resultado.avisos).toEqual([]);
    }
  });

  describe.each(fases)('fase $id', (fase) => {
    it('tem o mínimo de trocas esperado', () => {
      expect(fase.minimo).toBe(MINIMO_ESPERADO[fase.id]);
    });

    it('é zerável no mapa com o mínimo de trocas, valendo 3 estrelas', () => {
      const vitoria = resolver(fase);
      expect(vitoria).not.toBeNull();
      expect(vitoria?.estrelas).toBe(3);
      expect(vitoria?.trocas).toBe(fase.minimo);
      expect(vitoria?.erros).toBe(0);
      expect(vitoria?.alerta).toBeLessThanOrEqual(limiteAlerta(fase));
    });

    it('não é zerável com menos trocas que o mínimo', () => {
      if (fase.minimo > 0) expect(resolver(fase, fase.minimo - 1)).toBeNull();
    });

    it('tem dica e cabe na tela', () => {
      expect(fase.dica.length).toBeGreaterThan(20);
      expect(fase.largura).toBeLessThanOrEqual(13);
      expect(fase.altura).toBeLessThanOrEqual(11);
    });
  });
});
