import { iguais } from './formatar';
import { nuncaDeveAcontecer, paraBit, type Bit, type Formula, type Valoracao } from './tipos';

/**
 * Avalia uma fórmula sob uma valoração, recursivamente (de dentro para fora).
 * Cada `case` é a regra de verdade de um conectivo — a mesma da tabela-verdade.
 */
export function avaliar(no: Formula, v: Valoracao): boolean {
  switch (no.tipo) {
    case 'VAR': {
      const valor = v[no.nome];
      if (valor === undefined) {
        throw new Error(`A valoração não atribui valor à proposição ${no.nome}.`);
      }
      return valor === 1;
    }
    case 'NOT':
      return !avaliar(no.a, v);
    case 'AND':
      return avaliar(no.a, v) && avaliar(no.b, v);
    case 'OR':
      return avaliar(no.a, v) || avaliar(no.b, v);
    case 'XOR':
      return avaliar(no.a, v) !== avaliar(no.b, v);
    case 'IMP':
      return !avaliar(no.a, v) || avaliar(no.b, v);
    case 'IFF':
      return avaliar(no.a, v) === avaliar(no.b, v);
    default:
      return nuncaDeveAcontecer(no);
  }
}

/** Valor de uma subfórmula numa valoração. */
export interface Passo {
  readonly formula: Formula;
  readonly valor: Bit;
}

/**
 * Subfórmulas compostas (tudo menos as proposições soltas), de dentro para fora e sem
 * repetição. A última é a própria fórmula. São as colunas extras da tabela-verdade.
 */
export function subformulas(f: Formula): Formula[] {
  const lista: Formula[] = [];
  const visitar = (no: Formula): void => {
    if (no.tipo === 'VAR') return;
    visitar(no.a);
    if (no.tipo !== 'NOT') visitar(no.b);
    if (!lista.some((outra) => iguais(outra, no))) lista.push(no);
  };
  visitar(f);
  return lista;
}

/**
 * Avaliação passo a passo: o valor de cada subfórmula, na ordem em que o circuito é
 * recalculado (primeiro as portas internas, por último a saída).
 * Ex.: ¬P ∧ Q com P=1, Q=0  →  [¬P = 0, ¬P ∧ Q = 0].
 */
export function avaliarPassoAPasso(f: Formula, v: Valoracao): Passo[] {
  return subformulas(f).map((formula) => ({ formula, valor: paraBit(avaliar(formula, v)) }));
}
