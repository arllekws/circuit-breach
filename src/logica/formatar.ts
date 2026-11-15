import { nuncaDeveAcontecer, type Formula, type TipoFormula } from './tipos';

export type EstiloDeEscrita = 'simbolos' | 'texto';

const SIMBOLO: Readonly<Record<Exclude<TipoFormula, 'VAR'>, readonly [string, string]>> = {
  //      símbolos  texto
  NOT: ['¬', 'NOT '],
  AND: ['∧', 'AND'],
  OR: ['∨', 'OR'],
  XOR: ['⊕', 'XOR'],
  IMP: ['→', '->'],
  IFF: ['↔', '<->'],
};

/** Força de ligação de cada conectivo: NOT > AND > OR = XOR > -> > <->. */
function precedencia(tipo: TipoFormula): number {
  switch (tipo) {
    case 'VAR':
      return 6;
    case 'NOT':
      return 5;
    case 'AND':
      return 4;
    case 'OR':
    case 'XOR':
      return 3;
    case 'IMP':
      return 2;
    case 'IFF':
      return 1;
    default:
      return nuncaDeveAcontecer(tipo);
  }
}

/**
 * Escreve a fórmula como texto, com o mínimo de parênteses.
 * 'simbolos' → "(P → Q) ∧ R" (para a tela); 'texto' → "(P -> Q) AND R" (formato das fases).
 */
export function formatar(f: Formula, estilo: EstiloDeEscrita = 'simbolos'): string {
  const coluna = estilo === 'simbolos' ? 0 : 1;

  const filho = (pai: Formula, no: Formula, lado: 'esquerda' | 'direita'): string => {
    const texto = formatar(no, estilo);
    const pPai = precedencia(pai.tipo);
    const pNo = precedencia(no.tipo);
    // Filho que liga mais fraco precisa de parênteses. Na mesma precedência, só fica
    // sem parênteses o lado para o qual o conectivo associa (e se for o mesmo conectivo).
    const ladoQueAssocia = pai.tipo === 'IMP' ? 'direita' : 'esquerda';
    const precisa =
      pNo < pPai || (pNo === pPai && (lado !== ladoQueAssocia || no.tipo !== pai.tipo));
    return precisa ? `(${texto})` : texto;
  };

  switch (f.tipo) {
    case 'VAR':
      return f.nome;
    case 'NOT': {
      const dentro = formatar(f.a, estilo);
      const precisa = precedencia(f.a.tipo) < precedencia('NOT');
      return SIMBOLO.NOT[coluna] + (precisa ? `(${dentro})` : dentro);
    }
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'IMP':
    case 'IFF':
      return `${filho(f, f.a, 'esquerda')} ${SIMBOLO[f.tipo][coluna]} ${filho(f, f.b, 'direita')}`;
    default:
      return nuncaDeveAcontecer(f);
  }
}

/** Igualdade estrutural: as duas árvores têm exatamente a mesma forma. */
export function iguais(x: Formula, y: Formula): boolean {
  if (x.tipo === 'VAR' || y.tipo === 'VAR') {
    return x.tipo === 'VAR' && y.tipo === 'VAR' && x.nome === y.nome;
  }
  if (x.tipo === 'NOT' || y.tipo === 'NOT') {
    return x.tipo === 'NOT' && y.tipo === 'NOT' && iguais(x.a, y.a);
  }
  return x.tipo === y.tipo && iguais(x.a, y.a) && iguais(x.b, y.b);
}

/** Nome da porta lógica como aparece no painel do circuito. */
export function nomeDoConectivo(tipo: Exclude<TipoFormula, 'VAR'>): string {
  switch (tipo) {
    case 'IMP':
      return 'IMPLICA';
    case 'IFF':
      return 'BICOND';
    default:
      return tipo;
  }
}
