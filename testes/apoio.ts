import { validarFase } from '../src/fases/validar';
import { aplicar } from '../src/jogo/aplicar';
import { novoEstado } from '../src/jogo/estado';
import type { Acao, Estado, Fase } from '../src/jogo/tipos';

/** Valida um JSON de fase e devolve a fase, falhando o teste com os erros se for inválida. */
export function faseDe(json: unknown): Fase {
  const resultado = validarFase(json);
  if (!resultado.ok) throw new Error(`Fase inválida:\n- ${resultado.erros.join('\n- ')}`);
  return resultado.fase;
}

const COMANDOS: Readonly<Record<string, Acao>> = {
  '^': { tipo: 'mover', direcao: 'cima' },
  v: { tipo: 'mover', direcao: 'baixo' },
  '<': { tipo: 'mover', direcao: 'esquerda' },
  '>': { tipo: 'mover', direcao: 'direita' },
  e: { tipo: 'interagir' },
  q: { tipo: 'scanner' },
  c: { tipo: 'confirmar' },
  r: { tipo: 'reiniciar' },
  p: { tipo: 'pausar' },
};

/**
 * Executa uma sequência de comandos: ^ v < > movem, "e" interage, "q" usa o Scanner,
 * "c" confirma (Enter),
 * "r" reinicia, "p" pausa (Esc). Espaços são ignorados (servem para separar etapas).
 */
export function jogar(estado: Estado, comandos: string): Estado {
  let atual = estado;
  for (const simbolo of comandos.replace(/\s/g, '')) {
    const acao = COMANDOS[simbolo];
    if (acao === undefined) throw new Error(`Comando desconhecido: "${simbolo}"`);
    atual = aplicar(atual, acao);
  }
  return atual;
}

const marcarLinhas = (...indices: number[]): Acao[] => indices.map((indice) => ({ tipo: 'selecionar', indice }));
const regra = (botao: number): Acao => ({ tipo: 'aplicarRegra', botao });
/** Botões de regra, na ordem de `botoesDeRegra`. */
export const BOTAO = { MP: 0, MT: 1, SH: 2, SD: 3, SIMP_ESQ: 4, SIMP_DIR: 5, CONJ: 6, AD: 7 } as const;

/** Provas completas (sem erros) de cada desafio de prova, por "fase:terminal". Linhas contam de 0. */
export const ROTEIROS_DE_PROVA: Readonly<Record<string, Acao[]>> = {
  '5-2:N': [
    // Prova 1 — P → Q, Q → R, ¬R ⊢ ¬P
    ...marcarLinhas(0, 1), regra(BOTAO.SH), //   4. P → R      SH (1, 2)
    ...marcarLinhas(3, 2), regra(BOTAO.MT), //   5. ¬P         MT (4, 3)
    // Prova 2 — P ∧ Q, P → R ∨ S, ¬R ⊢ S
    ...marcarLinhas(0), regra(BOTAO.SIMP_ESQ), // 4. P         SIMP (1)
    ...marcarLinhas(1, 3), regra(BOTAO.MP), //    5. R ∨ S     MP (2, 4)
    ...marcarLinhas(4, 2), regra(BOTAO.SD), //    6. S         SD (5, 3)
    // Prova 3 — P, Q, P ∧ Q → R ⊢ R ∨ S
    ...marcarLinhas(0, 1), regra(BOTAO.CONJ), //  4. P ∧ Q     CONJ (1, 2)
    ...marcarLinhas(2, 3), regra(BOTAO.MP), //    5. R         MP (3, 4)
    ...marcarLinhas(4), regra(BOTAO.AD), //       6. R ∨ S     AD (5)
  ],
};

/**
 * Resolve o desafio aberto sem cometer nenhum erro, por busca em largura sobre as ações de
 * desafio (usando só `aplicar`). Devolve o estado logo após a solução, ou null se não há.
 */
export function resolverDesafio(aberto: Estado): Estado | null {
  const terminal = aberto.fase.desafios.find((t) => t.nome === aberto.desafio?.nome);
  if (terminal === undefined) return null;
  const definicao = terminal.desafio;
  const acoes: Acao[] = [];
  if (definicao.tipo === 'montagem') {
    for (let espaco = 0; espaco < definicao.espacos; espaco++) {
      for (const porta of definicao.opcoes) acoes.push({ tipo: 'escolherPorta', espaco, porta });
    }
    acoes.push({ tipo: 'confirmar' });
  } else if (definicao.tipo === 'espelho') {
    const maximo = Math.max(...definicao.rodadas.map((rodada) => rodada.cabos.length));
    for (let indice = 0; indice < maximo; indice++) acoes.push({ tipo: 'escolherCabo', indice });
  } else if (definicao.tipo === 'terminais') {
    definicao.terminais.forEach((_, indice) => {
      acoes.push({ tipo: 'marcar', indice, valor: 0 }, { tipo: 'marcar', indice, valor: 1 });
    });
    acoes.push({ tipo: 'confirmar' });
  } else {
    // Provas: o espaço de busca é grande demais; usa-se a prova escrita em ROTEIROS_DE_PROVA.
    const roteiro = ROTEIROS_DE_PROVA[`${aberto.fase.id}:${terminal.nome}`] ?? [];
    const fim = roteiro.reduce(aplicar, aberto);
    return fim.evento === 'desafio_resolvido' && fim.erros === aberto.erros ? fim : null;
  }
  const vistos = new Set([JSON.stringify(aberto.desafio)]);
  let fronteira = [aberto];
  while (fronteira.length > 0) {
    const proxima: Estado[] = [];
    for (const estado of fronteira) {
      for (const acao of acoes) {
        const novo = aplicar(estado, acao);
        if (novo.evento === 'desafio_resolvido') return novo;
        if (novo.evento !== 'desafio_escolha' && novo.evento !== 'desafio_avancou') continue;
        const chave = JSON.stringify(novo.desafio);
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        proxima.push(novo);
      }
    }
    fronteira = proxima;
  }
  return null;
}

/**
 * Solucionador para os testes: busca em largura sobre os estados do jogo (posição, direção,
 * caixas, valoração), usando só `aplicar`. Devolve o estado de vitória alcançado com no
 * máximo `maximoDeTrocas` trocas, ou null se a fase não pode ser vencida assim.
 * Prova que a fase é zerável NO MAPA — não só que a fórmula tem solução.
 */
export function resolver(fase: Fase, maximoDeTrocas: number = fase.minimo): Estado | null {
  const acoes: Acao[] = [
    { tipo: 'mover', direcao: 'cima' },
    { tipo: 'mover', direcao: 'baixo' },
    { tipo: 'mover', direcao: 'esquerda' },
    { tipo: 'mover', direcao: 'direita' },
    { tipo: 'interagir' },
  ];
  const chave = (e: Estado): string =>
    JSON.stringify([e.jogador, e.direcao, e.caixas, e.valoracao, e.trocas]);
  const inicial = novoEstado(fase);
  const vistos = new Set([chave(inicial)]);
  let fronteira = [inicial];
  while (fronteira.length > 0) {
    const proxima: Estado[] = [];
    for (const estado of fronteira) {
      for (const acao of acoes) {
        let novo = aplicar(estado, acao);
        if (novo.evento === 'desafio_aberto') {
          const resolvido = resolverDesafio(novo);
          if (resolvido === null) continue;
          novo = { ...resolvido, evento: 'troca' }; // segue a busca a partir do mapa
        }
        if (novo.situacao === 'vitoria') return novo;
        // Reinícios (alarme, alerta) e passos bloqueados não levam a lugar nenhum.
        if (novo.evento !== 'andou' && novo.evento !== 'troca') continue;
        if (novo.trocas > maximoDeTrocas || vistos.has(chave(novo))) continue;
        vistos.add(chave(novo));
        proxima.push(novo);
      }
    }
    fronteira = proxima;
  }
  return null;
}
