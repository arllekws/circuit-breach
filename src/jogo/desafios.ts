import { equivalentes } from '../logica/equivalentes';
import { formatar, iguais } from '../logica/formatar';
import { aplicarRegra, REGRAS, type ComplementoDaRegra, type Regra } from '../logica/inferencia';
import { analisar } from '../logica/parser';
import { satisfaz } from '../logica/satisfatibilidade';
import type { Bit, ConectivoBinario, Formula } from '../logica/tipos';
import { novoEstado } from './estado';
import { limiteAlerta } from './regras';
import type { Acao, Estado, TerminalDeDesafio } from './tipos';

// Desafios do Firewall (Setor 4) e do Núcleo (Setor 5). Estado e transições puras, como o
// resto de jogo/. Em todos, o teclado funciona (setas movem o cursor, E marca, Enter confirma)
// e o mouse manda ações diretas (selecionar, escolherPorta, escolherCabo, marcar, aplicarRegra).

// ───────────────────────────── definições (vêm do JSON da fase) ─────────────────────────────

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

/** Um terminal que fala: `nome` é a proposição "este terminal é confiável". */
export interface TerminalFalante {
  readonly nome: string;
  /** O que o terminal diz, em português. */
  readonly fala: string;
  /** A tradução para a lógica: se A diz φ, então vale A ↔ φ. */
  readonly formula: Formula;
}

/**
 * Terminais confiáveis (sempre dizem a verdade) e comprometidos (sempre mentem).
 * O jogador marca cada terminal; a marcação é uma valoração, e ela precisa satisfazer
 * todas as fórmulas ao mesmo tempo.
 */
export interface Terminais {
  readonly tipo: 'terminais';
  readonly terminais: readonly TerminalFalante[];
}

export interface Premissa {
  readonly formula: Formula;
  /** O log do sistema que a premissa traduz. */
  readonly log: string;
}

/** Uma prova do Núcleo Central: premissas, a conclusão pedida e as fórmulas oferecidas à Adição. */
export interface ProvaPedida {
  readonly premissas: readonly Premissa[];
  readonly meta: Formula;
  readonly adicoes: readonly Formula[];
}

/**
 * Núcleo Central (chefe final): chegar à conclusão aplicando regras de inferência.
 * O jogo valida cada passo; passo inválido é recusado e soma alerta.
 */
export interface Prova {
  readonly tipo: 'prova';
  readonly rodadas: readonly ProvaPedida[];
}

export type DefinicaoDoDesafio = Montagem | Espelho | Terminais | Prova;

// ───────────────────────────── estado do desafio aberto ─────────────────────────────

export interface LinhaDaProva {
  readonly formula: Formula;
  /** "premissa" ou a regra e as linhas usadas, ex.: "SH (1, 2)". */
  readonly justificativa: string;
}

export type EstadoDoDesafio =
  | {
      readonly tipo: 'montagem';
      /** Proposição do terminal do mapa (vira 1 quando o desafio é resolvido). */
      readonly nome: string;
      readonly escolhas: readonly (ConectivoBinario | null)[];
      readonly cursor: number;
    }
  | { readonly tipo: 'espelho'; readonly nome: string; readonly rodada: number; readonly cursor: number }
  | {
      readonly tipo: 'terminais';
      readonly nome: string;
      /** 1 = confiável, 0 = comprometido, null = ainda não marcado. */
      readonly marcas: readonly (Bit | null)[];
      readonly cursor: number;
    }
  | {
      readonly tipo: 'prova';
      readonly nome: string;
      readonly rodada: number;
      readonly linhas: readonly LinhaDaProva[];
      /** Índices das linhas marcadas para a próxima regra, na ordem em que foram marcadas. */
      readonly selecionadas: readonly number[];
      /** Linha sob o cursor do teclado. */
      readonly cursor: number;
      /** Botão de regra sob o cursor do teclado. */
      readonly botao: number;
      /** Motivo da última recusa (passo inválido), para mostrar na tela. */
      readonly recusa: string | null;
    };

type DesafioDeProva = Extract<EstadoDoDesafio, { tipo: 'prova' }>;

function inicioDaProva(nome: string, definicao: Prova, rodada: number): DesafioDeProva {
  const pedida = definicao.rodadas[rodada];
  return {
    tipo: 'prova',
    nome,
    rodada,
    linhas: (pedida?.premissas ?? []).map((p) => ({ formula: p.formula, justificativa: 'premissa' })),
    selecionadas: [],
    cursor: 0,
    botao: 0,
    recusa: null,
  };
}

export function abrirDesafio(terminal: TerminalDeDesafio): EstadoDoDesafio {
  const { desafio, nome } = terminal;
  switch (desafio.tipo) {
    case 'montagem':
      return { tipo: 'montagem', nome, escolhas: Array<null>(desafio.espacos).fill(null), cursor: 0 };
    case 'espelho':
      return { tipo: 'espelho', nome, rodada: 0, cursor: 0 };
    case 'terminais':
      return { tipo: 'terminais', nome, marcas: Array<null>(desafio.terminais.length).fill(null), cursor: 0 };
    case 'prova':
      return inicioDaProva(nome, desafio, 0);
  }
}

// ───────────────────────────── montagem ─────────────────────────────

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

// ───────────────────────────── prova ─────────────────────────────

/** Botão de regra na tela da prova: a regra e, quando ela pede, o complemento já escolhido. */
export interface BotaoDeRegra {
  readonly regra: Regra;
  readonly complemento: ComplementoDaRegra;
  readonly rotulo: string;
}

/** Os botões de regra de uma prova: as 7 regras (Simplificação tem dois lados; Adição, uma por fórmula). */
export function botoesDeRegra(pedida: ProvaPedida): BotaoDeRegra[] {
  return [
    { regra: 'MP', complemento: {}, rotulo: 'MP' },
    { regra: 'MT', complemento: {}, rotulo: 'MT' },
    { regra: 'SH', complemento: {}, rotulo: 'SH' },
    { regra: 'SD', complemento: {}, rotulo: 'SD' },
    { regra: 'SIMP', complemento: { lado: 'esquerda' }, rotulo: 'SIMP esq.' },
    { regra: 'SIMP', complemento: { lado: 'direita' }, rotulo: 'SIMP dir.' },
    { regra: 'CONJ', complemento: {}, rotulo: 'CONJ' },
    ...pedida.adicoes.map(
      (formula): BotaoDeRegra => ({ regra: 'AD', complemento: { formula }, rotulo: `AD ∨ ${formatar(formula)}` }),
    ),
  ];
}

// ───────────────────────────── transições ─────────────────────────────

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

  if (aberto.tipo === 'terminais' && definicao.tipo === 'terminais') {
    const n = definicao.terminais.length;
    const marcar = (indice: number, valor: Bit): Estado =>
      com({ ...aberto, cursor: indice, marcas: aberto.marcas.map((m, i) => (i === indice ? valor : m)) });
    switch (acao.tipo) {
      case 'mover':
        if (acao.direcao === 'esquerda') return com({ ...aberto, cursor: limitar(aberto.cursor - 1, n) });
        if (acao.direcao === 'direita') return com({ ...aberto, cursor: limitar(aberto.cursor + 1, n) });
        // ↑ marca como confiável (1); ↓ marca como comprometido (0).
        return marcar(aberto.cursor, acao.direcao === 'cima' ? 1 : 0);
      case 'interagir':
        return marcar(aberto.cursor, aberto.marcas[aberto.cursor] === 1 ? 0 : 1);
      case 'selecionar':
        return com({ ...aberto, cursor: limitar(acao.indice, n) });
      case 'marcar':
        if (acao.indice < 0 || acao.indice >= n) return parado;
        return marcar(acao.indice, acao.valor);
      case 'confirmar': {
        if (aberto.marcas.some((marca) => marca === null)) return parado;
        // A marcação do jogador É uma valoração: "A = 1" quer dizer "A é confiável".
        const valoracao: Record<string, Bit> = {};
        definicao.terminais.forEach((t, i) => (valoracao[t.nome] = aberto.marcas[i] as Bit));
        const todasVerdadeiras = satisfaz(
          { devemSer1: definicao.terminais.map((t) => t.formula), devemSer0: [] },
          valoracao,
        );
        return todasVerdadeiras ? resolver(estado, aberto.nome) : errar(estado, aberto);
      }
      default:
        return parado;
    }
  }

  if (aberto.tipo === 'prova' && definicao.tipo === 'prova') {
    const pedida = definicao.rodadas[aberto.rodada];
    if (pedida === undefined) return parado;
    const botoes = botoesDeRegra(pedida);
    /** Marca/desmarca uma linha. No máximo 2 ficam marcadas (a mais antiga sai). */
    const alternar = (indice: number): Estado => {
      if (indice < 0 || indice >= aberto.linhas.length) return parado;
      const selecionadas = aberto.selecionadas.includes(indice)
        ? aberto.selecionadas.filter((i) => i !== indice)
        : [...aberto.selecionadas, indice].slice(-2);
      return com({ ...aberto, cursor: indice, selecionadas, recusa: null });
    };
    const aplicarBotao = (indice: number): Estado => {
      const botao = botoes[indice];
      if (botao === undefined) return parado;
      const premissas = aberto.selecionadas.map((i) => (aberto.linhas[i] as LinhaDaProva).formula);
      // O validador de inferência decide: as árvores casam com o esquema da regra?
      const resultado = aplicarRegra(botao.regra, premissas, botao.complemento);
      if (!resultado.ok) {
        // Passo inválido: recusado, soma alerta, e a prova continua de onde estava.
        return errar(estado, { ...aberto, botao: indice, selecionadas: [], recusa: resultado.motivo });
      }
      if (aberto.linhas.some((l) => iguais(l.formula, resultado.conclusao))) {
        return { ...parado, desafio: { ...aberto, botao: indice, recusa: 'Essa fórmula já está na prova.' } };
      }
      const usadas = aberto.selecionadas.map((i) => i + 1).join(', ');
      const linhas: LinhaDaProva[] = [
        ...aberto.linhas,
        { formula: resultado.conclusao, justificativa: `${REGRAS[botao.regra].nome} (${usadas})` },
      ];
      if (iguais(resultado.conclusao, pedida.meta)) {
        // Chegou à conclusão pedida: próxima prova, ou Núcleo desligado.
        if (aberto.rodada + 1 === definicao.rodadas.length) return resolver(estado, aberto.nome);
        return {
          ...estado,
          desafio: inicioDaProva(aberto.nome, definicao, aberto.rodada + 1),
          evento: 'desafio_avancou',
        };
      }
      return {
        ...estado,
        desafio: { ...aberto, linhas, selecionadas: [], cursor: linhas.length - 1, botao: indice, recusa: null },
        evento: 'desafio_avancou',
      };
    };
    switch (acao.tipo) {
      case 'mover':
        if (acao.direcao === 'cima') return com({ ...aberto, cursor: limitar(aberto.cursor - 1, aberto.linhas.length) });
        if (acao.direcao === 'baixo') return com({ ...aberto, cursor: limitar(aberto.cursor + 1, aberto.linhas.length) });
        return com({ ...aberto, botao: limitar(aberto.botao + (acao.direcao === 'direita' ? 1 : -1), botoes.length) });
      case 'interagir':
        return alternar(aberto.cursor);
      case 'selecionar':
        return alternar(acao.indice);
      case 'aplicarRegra':
        return aplicarBotao(acao.botao);
      case 'confirmar':
        return aplicarBotao(aberto.botao);
      default:
        return parado;
    }
  }
  return parado;
}
