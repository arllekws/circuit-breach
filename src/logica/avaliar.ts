import { nuncaDeveAcontecer, type Formula, type Valoracao } from './tipos';

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
