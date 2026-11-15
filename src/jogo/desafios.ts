import { equivalentes } from '../logica/equivalentes';
import { analisar } from '../logica/parser';
import type { ConectivoBinario, Formula } from '../logica/tipos';
import { novoEstado } from './estado';
import { limiteAlerta } from './regras';
import type { Acao, Estado, TerminalDeDesafio } from './tipos';

// Desafios do Firewall (Setor 4). Estado e transições puras, como o resto de jogo/.
// Em todos, o teclado funciona (setas movem o cursor, Enter confirma) e o mouse manda
// ações diretas (selecionar, escolherPorta, escolherCabo).

/**
 * Montagem de circuito: o painel mostra uma tabela-verdade-alvo e um circuito com espaços
 * vazios (?1, ?2, …). O jogador escolhe uma porta lógica para cada espaço. Vale QUALQUER
 * circuito com a mesma tabela-verdade do alvo — o jogo compara tabelas, não desenhos.
 */
export interface Montagem {
  readonly tipo: 'montagem';
  readonly alvo: Formula;
  /** O alvo em palavras, ex.: "1 só quando A e B são diferentes". */
  readonly descricao: string;
  /** Circuito com espaços, ex.: "(A ?1 B) ?2 NOT (A ?3 B)". */
  readonly molde: string;
  readonly espacos: number;
  /** Portas lógicas disponíveis para encaixar. */
  readonly opcoes: readonly ConectivoBinario[];
}

/** Uma rodada do firewall espelhado: uma fórmula e os cabos oferecidos. */
export interface Rodada {
  readonly original: Formula;
  readonly cabos: readonly Formula[];
}

/**
 * Firewall espelhado: em cada rodada, só o cabo logicamente equivalente à fórmula do painel
 * (mesma tabela-verdade) contorna o firewall; o outro dispara o alarme.
 */
export interface Espelho {
  readonly tipo: 'espelho';
  readonly rodadas: readonly Rodada[];
}

export type DefinicaoDoDesafio = Montagem | Espelho;

export type EstadoDoDesafio =
  | {
      readonly tipo: 'montagem';
      /** Proposição do terminal (vira 1 quando o desafio é resolvido). */
      readonly nome: string;
      readonly escolhas: readonly (ConectivoBinario | null)[];
      readonly cursor: number;
    }
  | {
      readonly tipo: 'espelho';
      readonly nome: string;
      readonly rodada: number;
      readonly cursor: number;
    };

export function abrirDesafio(terminal: TerminalDeDesafio): EstadoDoDesafio {
  const { desafio, nome } = terminal;
  switch (desafio.tipo) {
    case 'montagem':
      return { tipo: 'montagem', nome, escolhas: Array<null>(desafio.espacos).fill(null), cursor: 0 };
    case 'espelho':
      return { tipo: 'espelho', nome, rodada: 0, cursor: 0 };
  }
}

const TEXTO_DO_CONECTIVO: Readonly<Record<ConectivoBinario, string>> = {
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
  IMP: '->',
  IFF: '<->',
};

/**
 * Encaixa as portas escolhidas nos espaços do molde e devolve a fórmula montada,
 * ou null se ainda há espaço vazio.
 */
export function montarFormula(
  molde: string,
  escolhas: readonly (ConectivoBinario | null)[],
): Formula | null {
  if (escolhas.some((escolha) => escolha === null)) return null;
  const texto = molde.replace(/\?(\d+)/g, (_, numero: string) => {
    const escolha = escolhas[Number(numero) - 1];
    return escolha === null || escolha === undefined ? '?' : TEXTO_DO_CONECTIVO[escolha];
  });
  return analisar(texto);
}

const limitar = (valor: number, tamanho: number): number => Math.max(0, Math.min(tamanho - 1, valor));

/** Desafio resolvido: a proposição do terminal passa a valer 1 e o jogador volta ao mapa. */
function resolver(estado: Estado, nome: string): Estado {
  return {
    ...estado,
    valoracao: { ...estado.valoracao, [nome]: 1 },
    desafio: null,
    evento: 'desafio_resolvido',
  };
}

/** Tentativa errada: soma 1 ao alerta e conta como erro (tira estrela). */
function errar(estado: Estado, desafio: EstadoDoDesafio): Estado {
  const alerta = estado.alerta + 1;
  if (alerta > limiteAlerta(estado.fase)) return novoEstado(estado.fase, 'alerta_estourou');
  return { ...estado, alerta, erros: estado.erros + 1, desafio, evento: 'erro' };
}

/** Aplica uma ação com um desafio aberto. */
export function aplicarNoDesafio(estado: Estado, acao: Acao): Estado {
  const aberto = estado.desafio;
  const terminal = estado.fase.desafios.find((t) => t.nome === aberto?.nome);
  if (aberto === null || terminal === undefined) return estado;
  const definicao = terminal.desafio;
  const com = (desafio: EstadoDoDesafio): Estado => ({ ...estado, desafio, evento: 'desafio_escolha' });
  const parado: Estado = { ...estado, evento: 'bloqueado' };

  if (aberto.tipo === 'montagem' && definicao.tipo === 'montagem') {
    const encaixar = (espaco: number, porta: ConectivoBinario): Estado =>
      com({ ...aberto, cursor: espaco, escolhas: aberto.escolhas.map((e, i) => (i === espaco ? porta : e)) });
    /** Troca a porta do espaço sob o cursor pela próxima (ou anterior) da lista de opções. */
    const girar = (passo: number): Estado => {
      const atual = aberto.escolhas[aberto.cursor] ?? null;
      const n = definicao.opcoes.length;
      const indice = atual === null ? (passo > 0 ? 0 : n - 1) : (definicao.opcoes.indexOf(atual) + passo + n) % n;
      return encaixar(aberto.cursor, definicao.opcoes[indice] as ConectivoBinario);
    };
    switch (acao.tipo) {
      case 'mover':
        if (acao.direcao === 'esquerda') return com({ ...aberto, cursor: limitar(aberto.cursor - 1, definicao.espacos) });
        if (acao.direcao === 'direita') return com({ ...aberto, cursor: limitar(aberto.cursor + 1, definicao.espacos) });
        return girar(acao.direcao === 'baixo' ? 1 : -1);
      case 'interagir':
        return girar(1);
      case 'selecionar':
        return com({ ...aberto, cursor: limitar(acao.indice, definicao.espacos) });
      case 'escolherPorta':
        if (acao.espaco < 0 || acao.espaco >= definicao.espacos || !definicao.opcoes.includes(acao.porta)) return parado;
        return encaixar(acao.espaco, acao.porta);
      case 'confirmar': {
        const montada = montarFormula(definicao.molde, aberto.escolhas);
        if (montada === null) return parado; // ainda há espaço vazio
        // Equivalência = mesma tabela-verdade: é o que decide se o circuito serve.
        return equivalentes(montada, definicao.alvo) ? resolver(estado, aberto.nome) : errar(estado, aberto);
      }
      default:
        return parado;
    }
  }

  if (aberto.tipo === 'espelho' && definicao.tipo === 'espelho') {
    const rodada = definicao.rodadas[aberto.rodada];
    if (rodada === undefined) return parado;
    const ligar = (indice: number): Estado => {
      const cabo = rodada.cabos[indice];
      if (cabo === undefined) return parado;
      if (!equivalentes(rodada.original, cabo)) {
        // Cabo errado: alarme. O firewall volta à primeira rodada.
        return errar(estado, { ...aberto, rodada: 0, cursor: 0 });
      }
      if (aberto.rodada + 1 === definicao.rodadas.length) return resolver(estado, aberto.nome);
      return { ...estado, desafio: { ...aberto, rodada: aberto.rodada + 1, cursor: 0 }, evento: 'desafio_avancou' };
    };
    switch (acao.tipo) {
      case 'mover': {
        const passo = acao.direcao === 'esquerda' || acao.direcao === 'cima' ? -1 : 1;
        return com({ ...aberto, cursor: limitar(aberto.cursor + passo, rodada.cabos.length) });
      }
      case 'selecionar':
        return com({ ...aberto, cursor: limitar(acao.indice, rodada.cabos.length) });
      case 'escolherCabo':
        return ligar(acao.indice);
      case 'interagir':
      case 'confirmar':
        return ligar(aberto.cursor);
      default:
        return parado;
    }
  }
  return parado;
}
