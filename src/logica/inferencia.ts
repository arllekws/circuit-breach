import { formatar, iguais } from './formatar';
import { nuncaDeveAcontecer, type Formula } from './tipos';

/** Regras de inferência do Núcleo Central. */
export type Regra = 'MP' | 'MT' | 'SH' | 'SD' | 'SIMP' | 'CONJ' | 'AD';

export interface DescricaoDaRegra {
  readonly nome: string;
  /** Quantas linhas da prova a regra usa. */
  readonly premissas: 1 | 2;
  /** Esquema da regra, como na tabela do relatório. */
  readonly esquema: string;
}

export const REGRAS: Readonly<Record<Regra, DescricaoDaRegra>> = {
  MP: { nome: 'Modus Ponens', premissas: 2, esquema: 'A → B, A ⊢ B' },
  MT: { nome: 'Modus Tollens', premissas: 2, esquema: 'A → B, ¬B ⊢ ¬A' },
  SH: { nome: 'Silogismo Hipotético', premissas: 2, esquema: 'A → B, B → C ⊢ A → C' },
  SD: { nome: 'Silogismo Disjuntivo', premissas: 2, esquema: 'A ∨ B, ¬A ⊢ B' },
  SIMP: { nome: 'Simplificação', premissas: 1, esquema: 'A ∧ B ⊢ A' },
  CONJ: { nome: 'Conjunção', premissas: 2, esquema: 'A, B ⊢ A ∧ B' },
  AD: { nome: 'Adição', premissas: 1, esquema: 'A ⊢ A ∨ B' },
};

/** Informação extra que algumas regras pedem. */
export interface ComplementoDaRegra {
  /** Simplificação: qual lado da conjunção fica (padrão: esquerda). */
  readonly lado?: 'esquerda' | 'direita';
  /** Adição: a fórmula B que será acrescentada em A ∨ B. */
  readonly formula?: Formula;
}

export type ResultadoDaInferencia =
  | { readonly ok: true; readonly conclusao: Formula }
  | { readonly ok: false; readonly motivo: string };

const aceito = (conclusao: Formula): ResultadoDaInferencia => ({ ok: true, conclusao });
const recusado = (motivo: string): ResultadoDaInferencia => ({ ok: false, motivo });

/**
 * Cada função abaixo é UM padrão sobre árvores: recebe as premissas numa ordem fixa e
 * devolve a conclusão se as árvores casam com o esquema da regra, ou `null` se não casam.
 * "O mesmo A" do esquema é verificado com igualdade estrutural (`iguais`).
 */
type Padrao = (x: Formula, y: Formula) => Formula | null;

/** Modus Ponens: de (A → B) e A, conclui B. */
const modusPonens: Padrao = (implicacao, antecedente) =>
  implicacao.tipo === 'IMP' && iguais(implicacao.a, antecedente) ? implicacao.b : null;

/** Modus Tollens: de (A → B) e ¬B, conclui ¬A. */
const modusTollens: Padrao = (implicacao, negacao) =>
  implicacao.tipo === 'IMP' && negacao.tipo === 'NOT' && iguais(implicacao.b, negacao.a)
    ? { tipo: 'NOT', a: implicacao.a }
    : null;

/** Silogismo Hipotético: de (A → B) e (B → C), conclui (A → C). */
const silogismoHipotetico: Padrao = (primeira, segunda) =>
  primeira.tipo === 'IMP' && segunda.tipo === 'IMP' && iguais(primeira.b, segunda.a)
    ? { tipo: 'IMP', a: primeira.a, b: segunda.b }
    : null;

/** Silogismo Disjuntivo: de (A ∨ B) e ¬A, conclui B (ou, de ¬B, conclui A). */
const silogismoDisjuntivo: Padrao = (disjuncao, negacao) => {
  if (disjuncao.tipo !== 'OR' || negacao.tipo !== 'NOT') return null;
  if (iguais(disjuncao.a, negacao.a)) return disjuncao.b;
  if (iguais(disjuncao.b, negacao.a)) return disjuncao.a;
  return null;
};

/** Tenta o padrão com as premissas nas duas ordens: o jogador pode clicar em qualquer ordem. */
function emQualquerOrdem(padrao: Padrao, x: Formula, y: Formula): Formula | null {
  return padrao(x, y) ?? padrao(y, x);
}

/**
 * Validador de inferência: aplica `regra` às `premissas` e devolve a conclusão,
 * ou o motivo da recusa quando as premissas não casam com o esquema da regra.
 */
export function aplicarRegra(
  regra: Regra,
  premissas: readonly Formula[],
  complemento: ComplementoDaRegra = {},
): ResultadoDaInferencia {
  const { nome, premissas: quantas, esquema } = REGRAS[regra];
  const [x, y] = premissas;
  if (premissas.length !== quantas || x === undefined) {
    return recusado(`${nome} usa ${quantas} linha${quantas > 1 ? 's' : ''} da prova.`);
  }
  const naoCasa = (): ResultadoDaInferencia =>
    recusado(
      `${nome} não se aplica a ${premissas.map((p) => formatar(p)).join(' e ')}. Esquema: ${esquema}.`,
    );

  switch (regra) {
    case 'MP':
    case 'MT':
    case 'SH':
    case 'SD': {
      if (y === undefined) return naoCasa();
      const padrao = {
        MP: modusPonens,
        MT: modusTollens,
        SH: silogismoHipotetico,
        SD: silogismoDisjuntivo,
      }[regra];
      const conclusao = emQualquerOrdem(padrao, x, y);
      return conclusao === null ? naoCasa() : aceito(conclusao);
    }
    case 'SIMP':
      // Simplificação: de (A ∧ B), conclui A (ou B).
      if (x.tipo !== 'AND') return naoCasa();
      return aceito(complemento.lado === 'direita' ? x.b : x.a);
    case 'CONJ':
      // Conjunção: de A e B, conclui (A ∧ B).
      if (y === undefined) return naoCasa();
      return aceito({ tipo: 'AND', a: x, b: y });
    case 'AD':
      // Adição: de A, conclui (A ∨ B) para qualquer B escolhida.
      if (complemento.formula === undefined) {
        return recusado('Adição precisa da fórmula que será acrescentada.');
      }
      return aceito({ tipo: 'OR', a: x, b: complemento.formula });
    default:
      return nuncaDeveAcontecer(regra);
  }
}
