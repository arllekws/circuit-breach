import type { ConectivoBinario, Formula } from './tipos';

/** Erro de sintaxe com a posição (índice no texto, começando em 0) onde o problema foi encontrado. */
export class ErroDeSintaxe extends Error {
  constructor(
    mensagem: string,
    readonly posicao: number,
  ) {
    super(mensagem);
    this.name = 'ErroDeSintaxe';
  }
}

type TipoToken = 'VAR' | 'NOT' | ConectivoBinario | '(' | ')' | 'FIM';

interface Token {
  readonly tipo: TipoToken;
  readonly texto: string;
  readonly posicao: number;
}

/** Símbolos (de 1 a 3 caracteres) e o token que representam. Os mais longos vêm primeiro. */
const SIMBOLOS: readonly (readonly [string, TipoToken])[] = [
  ['<->', 'IFF'],
  ['->', 'IMP'],
  ['↔', 'IFF'],
  ['→', 'IMP'],
  ['¬', 'NOT'],
  ['~', 'NOT'],
  ['∧', 'AND'],
  ['∨', 'OR'],
  ['⊕', 'XOR'],
  ['(', '('],
  [')', ')'],
];

const PALAVRAS: Readonly<Record<string, TipoToken>> = {
  NOT: 'NOT',
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
};

/** Análise léxica: quebra o texto em tokens. */
function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  proximo: while (i < texto.length) {
    const c = texto.charAt(i);
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    for (const [simbolo, tipo] of SIMBOLOS) {
      if (texto.startsWith(simbolo, i)) {
        tokens.push({ tipo, texto: simbolo, posicao: i });
        i += simbolo.length;
        continue proximo;
      }
    }
    const palavra = /^[A-Za-z][A-Za-z0-9_]*/.exec(texto.slice(i))?.[0];
    if (palavra !== undefined) {
      const tipo = PALAVRAS[palavra.toUpperCase()] ?? 'VAR';
      tokens.push({ tipo, texto: tipo === 'VAR' ? palavra : palavra.toUpperCase(), posicao: i });
      i += palavra.length;
      continue;
    }
    throw new ErroDeSintaxe(`Símbolo inesperado "${c}" na posição ${i}.`, i);
  }
  tokens.push({ tipo: 'FIM', texto: '', posicao: texto.length });
  return tokens;
}

/**
 * Converte texto como "(P -> Q) AND R" em árvore sintática.
 *
 * Parser descendente recursivo: há uma função para cada nível de precedência,
 * da mais fraca para a mais forte. Quem liga mais forte fica mais fundo na árvore:
 *
 *   bicondicional  :=  implicacao ( '<->' implicacao )*      (mais fraco, à esquerda)
 *   implicacao     :=  disjuncao ( '->' implicacao )?        (associa à DIREITA)
 *   disjuncao      :=  conjuncao ( ('OR' | 'XOR') conjuncao )*
 *   conjuncao      :=  negacao ( 'AND' negacao )*
 *   negacao        :=  'NOT' negacao | atomo                 (mais forte)
 *   atomo          :=  PROPOSICAO | '(' bicondicional ')'
 */
export function analisar(texto: string): Formula {
  const tokens = tokenizar(texto);
  let cursor = 0;

  const atual = (): Token => tokens[cursor] as Token;
  const avancar = (): Token => tokens[cursor++] as Token;

  if (atual().tipo === 'FIM') {
    throw new ErroDeSintaxe('Fórmula vazia.', 0);
  }

  function bicondicional(): Formula {
    let esquerda = implicacao();
    while (atual().tipo === 'IFF') {
      avancar();
      esquerda = { tipo: 'IFF', a: esquerda, b: implicacao() };
    }
    return esquerda;
  }

  function implicacao(): Formula {
    const antecedente = disjuncao();
    if (atual().tipo === 'IMP') {
      avancar();
      // Recursão à direita: P -> Q -> R é lido como P -> (Q -> R).
      return { tipo: 'IMP', a: antecedente, b: implicacao() };
    }
    return antecedente;
  }

  function disjuncao(): Formula {
    let esquerda = conjuncao();
    for (let t = atual().tipo; t === 'OR' || t === 'XOR'; t = atual().tipo) {
      avancar();
      esquerda = { tipo: t, a: esquerda, b: conjuncao() };
    }
    return esquerda;
  }

  function conjuncao(): Formula {
    let esquerda = negacao();
    while (atual().tipo === 'AND') {
      avancar();
      esquerda = { tipo: 'AND', a: esquerda, b: negacao() };
    }
    return esquerda;
  }

  function negacao(): Formula {
    if (atual().tipo === 'NOT') {
      avancar();
      return { tipo: 'NOT', a: negacao() };
    }
    return atomo();
  }

  function atomo(): Formula {
    const token = avancar();
    if (token.tipo === 'VAR') {
      return { tipo: 'VAR', nome: token.texto };
    }
    if (token.tipo === '(') {
      const dentro = bicondicional();
      if (atual().tipo !== ')') {
        throw new ErroDeSintaxe(
          `Faltou fechar o parêntese aberto na posição ${token.posicao}.`,
          token.posicao,
        );
      }
      avancar();
      return dentro;
    }
    if (token.tipo === 'FIM') {
      throw new ErroDeSintaxe(
        'A fórmula terminou antes da hora: esperava uma proposição ou "(".',
        token.posicao,
      );
    }
    throw new ErroDeSintaxe(
      `Esperava uma proposição ou "(" na posição ${token.posicao}, mas encontrei "${token.texto}".`,
      token.posicao,
    );
  }

  const formula = bicondicional();
  const sobra = atual();
  if (sobra.tipo !== 'FIM') {
    const motivo =
      sobra.tipo === ')'
        ? `Parêntese ")" sem abertura na posição ${sobra.posicao}.`
        : `Esperava um conectivo na posição ${sobra.posicao}, mas encontrei "${sobra.texto}".`;
    throw new ErroDeSintaxe(motivo, sobra.posicao);
  }
  return formula;
}
