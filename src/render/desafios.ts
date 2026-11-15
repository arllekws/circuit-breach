import {
  botoesDeRegra,
  montarFormula,
  type Espelho,
  type EstadoDoDesafio,
  type Montagem,
  type Prova,
  type Terminais,
} from '../jogo/desafios';
import type { Estado } from '../jogo/tipos';
import { avaliar } from '../logica/avaliar';
import { formatar } from '../logica/formatar';
import { REGRAS } from '../logica/inferencia';
import { valoracoes, variaveis } from '../logica/tabelaVerdade';
import { paraBit, type Bit, type ConectivoBinario } from '../logica/tipos';
import { contornar, escrever, escreverParagrafo, linha, preencher, type Ctx } from './desenho';
import { AREA_MAPA, PAINEL, type RegiaoClicavel, type Retangulo } from './layout';
import { CORES, fonte } from './tema';

// Telas dos desafios do Firewall e do Núcleo. Cada função desenha o desafio aberto e devolve as regiões
// clicáveis (o mouse só transforma o clique na ação da região; a regra continua em jogo/).

/** A tela do desafio ocupa o lugar do mapa e do painel. */
const AREA: Retangulo = {
  x: AREA_MAPA.x,
  y: AREA_MAPA.y,
  w: PAINEL.x + PAINEL.w - AREA_MAPA.x,
  h: AREA_MAPA.h,
};
const MARGEM = 16;

const SIMBOLO: Readonly<Record<ConectivoBinario, string>> = { AND: '∧', OR: '∨', XOR: '⊕', IMP: '→', IFF: '↔' };

function moldura(ctx: Ctx, titulo: string, subtitulo: string): void {
  preencher(ctx, AREA, CORES.painel);
  contornar(ctx, AREA, CORES.bordaPainel);
  escrever(ctx, titulo, AREA.x + MARGEM, AREA.y + 20, { tamanho: 14, negrito: true });
  escrever(ctx, subtitulo, AREA.x + MARGEM, AREA.y + 42, { cor: CORES.textoSecundario });
  linha(ctx, [[AREA.x + MARGEM, AREA.y + 56], [AREA.x + AREA.w - MARGEM, AREA.y + 56]], CORES.bordaPainel);
}

function rodapeDoDesafio(ctx: Ctx, texto: string): void {
  escrever(ctx, texto, AREA.x + AREA.w / 2, AREA.y + AREA.h - 14, { cor: CORES.textoSecundario, alinhar: 'center' });
}

/** Caixa de escolha (porta lógica, cabo, botão): âmbar quando é a selecionada pelo jogador. */
function caixa(ctx: Ctx, r: Retangulo, selecionada: boolean): void {
  preencher(ctx, r, CORES.fundoMapa);
  contornar(ctx, r, selecionada ? CORES.jogador : CORES.zero, selecionada ? 2 : 1);
}

function desenharMontagem(
  ctx: Ctx,
  definicao: Montagem,
  aberto: Extract<EstadoDoDesafio, { tipo: 'montagem' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  moldura(ctx, 'FIREWALL · montagem de circuito', `Alvo: ${definicao.descricao}. Vale qualquer circuito equivalente.`);

  // --- o circuito com espaços, à esquerda ---
  const ESPACO = { w: 52, h: 28 };
  const partes = definicao.molde.split(/(\?\d+)/).filter((parte) => parte !== '');
  const textoDe = (parte: string): string => parte.replace(/NOT\s*/g, '¬').replace(/\s+/g, ' ');
  ctx.font = fonte(16, true);
  const larguras = partes.map((parte) => (parte.startsWith('?') ? ESPACO.w : ctx.measureText(textoDe(parte)).width));
  const esquerda: Retangulo = { x: AREA.x + MARGEM, y: AREA.y + 70, w: 400, h: 240 };
  let x = esquerda.x + (esquerda.w - larguras.reduce((soma, w) => soma + w, 0)) / 2;
  const yCircuito = esquerda.y + 40;
  partes.forEach((parte, i) => {
    const w = larguras[i] ?? 0;
    if (parte.startsWith('?')) {
      const espaco = Number(parte.slice(1)) - 1;
      const r: Retangulo = { x, y: yCircuito - ESPACO.h / 2, w: ESPACO.w - 4, h: ESPACO.h };
      const escolha = aberto.escolhas[espaco] ?? null;
      caixa(ctx, r, espaco === aberto.cursor);
      escrever(ctx, escolha ?? '?', r.x + r.w / 2, yCircuito + 0.5, {
        alinhar: 'center',
        negrito: true,
        cor: escolha === null ? CORES.textoSecundario : CORES.texto,
      });
      regioes.push({ r, acao: { tipo: 'selecionar', indice: espaco } });
    } else {
      escrever(ctx, textoDe(parte), x, yCircuito + 0.5, { tamanho: 16, negrito: true });
    }
    x += w;
  });

  // --- as portas lógicas disponíveis ---
  const yPortas = yCircuito + 62;
  escrever(ctx, `Porta para o espaço ${aberto.cursor + 1}:`, esquerda.x, yPortas - 26, { cor: CORES.textoSecundario });
  definicao.opcoes.forEach((opcao, i) => {
    const r: Retangulo = { x: esquerda.x + i * 76, y: yPortas - 14, w: 68, h: 28 };
    caixa(ctx, r, aberto.escolhas[aberto.cursor] === opcao);
    escrever(ctx, `${opcao} ${SIMBOLO[opcao]}`, r.x + r.w / 2, yPortas + 0.5, { alinhar: 'center', negrito: true });
    regioes.push({ r, acao: { tipo: 'escolherPorta', espaco: aberto.cursor, porta: opcao } });
  });

  // --- botão de teste ---
  const montada = montarFormula(definicao.molde, aberto.escolhas);
  const botao: Retangulo = { x: esquerda.x, y: yPortas + 40, w: 180, h: 30 };
  preencher(ctx, botao, CORES.fundoMapa);
  contornar(ctx, botao, montada === null ? CORES.zero : CORES.texto, montada === null ? 1 : 2);
  escrever(ctx, 'TESTAR CIRCUITO', botao.x + botao.w / 2, botao.y + botao.h / 2 + 0.5, {
    alinhar: 'center',
    negrito: true,
    cor: montada === null ? CORES.textoSecundario : CORES.texto,
  });
  regioes.push({ r: botao, acao: { tipo: 'confirmar' } });
  if (montada !== null) {
    escrever(ctx, `Seu circuito: ${formatar(montada)}`, esquerda.x, botao.y + botao.h + 22, {});
  }

  // --- tabela-verdade: alvo ao lado do circuito montado ---
  const nomes = variaveis(definicao.alvo);
  const xTabela = AREA.x + AREA.w - 216;
  const colunas = [...nomes, 'alvo', 'seu'];
  const xColuna = (i: number): number => xTabela + 14 + i * 34 + (i >= nomes.length ? 18 : 0);
  const yTabela = AREA.y + 84;
  escrever(ctx, 'TABELA-VERDADE', xTabela, yTabela - 12, { cor: CORES.textoSecundario });
  colunas.forEach((coluna, i) => escrever(ctx, coluna, xColuna(i), yTabela + 10, { alinhar: 'center', negrito: true }));
  linha(ctx, [[xTabela, yTabela + 20], [xTabela + 190, yTabela + 20]], CORES.zero);
  valoracoes(nomes).forEach((v, n) => {
    const y = yTabela + 34 + n * 18;
    nomes.forEach((nome, i) => escrever(ctx, String(v[nome]), xColuna(i), y, { alinhar: 'center' }));
    const alvo = paraBit(avaliar(definicao.alvo, v));
    escrever(ctx, String(alvo), xColuna(nomes.length), y, { alinhar: 'center', negrito: true });
    if (montada === null) {
      escrever(ctx, '?', xColuna(nomes.length + 1), y, { alinhar: 'center', cor: CORES.textoSecundario });
    } else {
      // Verde com "=" quando a linha bate com o alvo; vermelho com "≠" quando não bate.
      const seu = paraBit(avaliar(montada, v));
      const igual = seu === alvo;
      const cor = igual ? CORES.sucesso : CORES.perigo;
      escrever(ctx, String(seu), xColuna(nomes.length + 1), y, { alinhar: 'center', negrito: true, cor });
      escrever(ctx, igual ? '=' : '≠', xColuna(nomes.length + 1) + 20, y, { alinhar: 'center', cor });
    }
  });

  rodapeDoDesafio(ctx, '←→ escolhe o espaço · ↑↓ troca a porta · Enter testa · Esc volta ao mapa');
  return regioes;
}

function desenharEspelho(
  ctx: Ctx,
  definicao: Espelho,
  aberto: Extract<EstadoDoDesafio, { tipo: 'espelho' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  moldura(
    ctx,
    `FIREWALL ESPELHADO · rodada ${aberto.rodada + 1} de ${definicao.rodadas.length}`,
    'Só o cabo equivalente (mesma tabela-verdade) contorna o firewall. O outro dispara o alarme.',
  );
  const rodada = definicao.rodadas[aberto.rodada];
  if (rodada === undefined) return regioes;
  const cx = AREA.x + AREA.w / 2;

  // A fórmula do painel.
  escrever(ctx, 'PAINEL', cx, AREA.y + 82, { cor: CORES.textoSecundario, alinhar: 'center' });
  const painel: Retangulo = { x: cx - 150, y: AREA.y + 94, w: 300, h: 46 };
  preencher(ctx, painel, CORES.fundoMapa);
  contornar(ctx, painel, CORES.texto, 2);
  escrever(ctx, formatar(rodada.original), cx, painel.y + painel.h / 2 + 0.5, { tamanho: 20, negrito: true, alinhar: 'center' });

  // Os cabos.
  const largura = 250;
  const vao = 24;
  const total = rodada.cabos.length * largura + (rodada.cabos.length - 1) * vao;
  rodada.cabos.forEach((cabo, i) => {
    const r: Retangulo = { x: cx - total / 2 + i * (largura + vao), y: AREA.y + 190, w: largura, h: 60 };
    const selecionado = i === aberto.cursor;
    // Fio tracejado do painel até o cabo.
    linha(ctx, [[cx, painel.y + painel.h], [r.x + r.w / 2, r.y]], selecionado ? CORES.jogador : CORES.zero, 1, [3, 4]);
    caixa(ctx, r, selecionado);
    escrever(ctx, `${selecionado ? '> ' : ''}CABO ${i + 1}`, r.x + 10, r.y + 14, {
      cor: selecionado ? CORES.jogador : CORES.textoSecundario,
      negrito: selecionado,
    });
    escrever(ctx, formatar(cabo), r.x + r.w / 2, r.y + 38, { tamanho: 16, negrito: true, alinhar: 'center' });
    regioes.push({ r, acao: { tipo: 'escolherCabo', indice: i } });
  });

  rodapeDoDesafio(ctx, '←→ escolhe o cabo · Enter liga · Esc volta ao mapa');
  return regioes;
}

function desenharTerminais(
  ctx: Ctx,
  definicao: Terminais,
  aberto: Extract<EstadoDoDesafio, { tipo: 'terminais' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  moldura(
    ctx,
    'TERMINAIS DE SEGURANÇA',
    'Confiável sempre diz a verdade; comprometido sempre mente. Se A diz φ, então vale A ↔ φ.',
  );
  const n = definicao.terminais.length;
  const vao = 12;
  const largura = (AREA.w - MARGEM * 2 - (n - 1) * vao) / n;
  definicao.terminais.forEach((terminal, i) => {
    const r: Retangulo = { x: AREA.x + MARGEM + i * (largura + vao), y: AREA.y + 68, w: largura, h: 196 };
    const noCursor = i === aberto.cursor;
    caixa(ctx, r, noCursor);
    regioes.push({ r, acao: { tipo: 'selecionar', indice: i } });
    const x = r.x + 10;
    escrever(ctx, `${noCursor ? '> ' : ''}TERMINAL ${terminal.nome}`, x, r.y + 16, {
      negrito: true,
      cor: noCursor ? CORES.jogador : CORES.texto,
    });
    const yDepoisDaFala = escreverParagrafo(ctx, `"${terminal.fala}"`, x, r.y + 40, r.w - 20, {});
    escrever(ctx, 'Tradução:', x, yDepoisDaFala + 8, { cor: CORES.textoSecundario });
    escrever(ctx, formatar(terminal.formula), x, yDepoisDaFala + 26, { tamanho: 14, negrito: true });

    // Marcação: 1 = confiável (ciano preenchido), 0 = comprometido (contorno). "[x]" mostra a escolha.
    const marca = aberto.marcas[i] ?? null;
    const opcoes: [Bit, string][] = [[1, 'CONFIÁVEL · 1'], [0, 'COMPROMETIDO · 0']];
    opcoes.forEach(([valor, rotulo], k) => {
      const botao: Retangulo = { x, y: r.y + r.h - 62 + k * 28, w: r.w - 20, h: 24 };
      const escolhido = marca === valor;
      if (escolhido && valor === 1) {
        preencher(ctx, botao, CORES.um);
      } else {
        preencher(ctx, botao, CORES.painel);
        contornar(ctx, botao, escolhido ? CORES.texto : CORES.zero, escolhido ? 2 : 1);
      }
      escrever(ctx, `${escolhido ? '[x]' : '[ ]'} ${rotulo}`, botao.x + 8, botao.y + botao.h / 2 + 0.5, {
        negrito: escolhido,
        cor: escolhido && valor === 1 ? CORES.fundoTela : escolhido ? CORES.texto : CORES.textoSecundario,
      });
      regioes.push({ r: botao, acao: { tipo: 'marcar', indice: i, valor } });
    });
  });

  const completo = aberto.marcas.every((marca) => marca !== null);
  const botao: Retangulo = { x: AREA.x + AREA.w / 2 - 100, y: AREA.y + 274, w: 200, h: 28 };
  preencher(ctx, botao, CORES.fundoMapa);
  contornar(ctx, botao, completo ? CORES.texto : CORES.zero, completo ? 2 : 1);
  escrever(ctx, 'CONFERIR MARCAÇÃO', botao.x + botao.w / 2, botao.y + botao.h / 2 + 0.5, {
    alinhar: 'center',
    negrito: true,
    cor: completo ? CORES.texto : CORES.textoSecundario,
  });
  regioes.push({ r: botao, acao: { tipo: 'confirmar' } });

  rodapeDoDesafio(ctx, '←→ terminal · ↑ confiável · ↓ comprometido · Enter confere · Esc volta ao mapa');
  // Os botões ficam dentro dos cartões: invertendo a lista, o clique acha primeiro o botão.
  return regioes.reverse();
}

const LINHAS_VISIVEIS = 9;

function desenharProva(
  ctx: Ctx,
  definicao: Prova,
  aberto: Extract<EstadoDoDesafio, { tipo: 'prova' }>,
): RegiaoClicavel[] {
  const regioes: RegiaoClicavel[] = [];
  const pedida = definicao.rodadas[aberto.rodada];
  if (pedida === undefined) return regioes;
  moldura(
    ctx,
    `NÚCLEO CENTRAL · prova ${aberto.rodada + 1} de ${definicao.rodadas.length}`,
    'Marque linhas e aplique uma regra de inferência. Passo inválido é recusado e soma alerta.',
  );
  // A conclusão pedida, em verde (o resultado certo).
  escrever(ctx, `META: ${formatar(pedida.meta)}`, AREA.x + AREA.w - MARGEM, AREA.y + 20, {
    cor: CORES.sucesso,
    tamanho: 14,
    negrito: true,
    alinhar: 'right',
  });

  // --- linhas da prova, à esquerda ---
  const x = AREA.x + MARGEM;
  const larguraDasLinhas = 404;
  const primeira = Math.max(0, Math.min(aberto.cursor - (LINHAS_VISIVEIS - 1), aberto.linhas.length - LINHAS_VISIVEIS));
  aberto.linhas.slice(primeira, primeira + LINHAS_VISIVEIS).forEach((linhaDaProva, k) => {
    const i = primeira + k;
    const r: Retangulo = { x, y: AREA.y + 66 + k * 23, w: larguraDasLinhas, h: 21 };
    const meio = r.y + r.h / 2 + 0.5;
    const marcada = aberto.selecionadas.includes(i);
    preencher(ctx, r, CORES.fundoMapa);
    if (marcada) contornar(ctx, r, CORES.jogador, 2);
    if (i === aberto.cursor) escrever(ctx, '>', r.x + 4, meio, { cor: CORES.jogador, negrito: true });
    escrever(ctx, `${marcada ? '[x]' : '[ ]'} ${i + 1}.`, r.x + 16, meio, {
      cor: marcada ? CORES.jogador : CORES.textoSecundario,
      negrito: marcada,
    });
    const textoDaFormula = formatar(linhaDaProva.formula);
    escrever(ctx, textoDaFormula, r.x + 64, meio, { negrito: true });
    // À direita da fórmula: o log (premissa) ou a regra que gerou a linha.
    const premissa = linhaDaProva.justificativa === 'premissa' ? pedida.premissas[i] : undefined;
    const nota = premissa !== undefined ? `log: ${premissa.log}` : linhaDaProva.justificativa;
    ctx.font = fonte(11, true);
    const xNota = r.x + 64 + ctx.measureText(textoDaFormula).width + 12;
    ctx.font = fonte();
    let cortada = nota;
    while (cortada.length > 4 && ctx.measureText(cortada).width > r.x + r.w - xNota - 4) {
      cortada = `${cortada.slice(0, -2)}…`;
    }
    escrever(ctx, cortada, xNota, meio, { cor: CORES.textoSecundario });
    regioes.push({ r, acao: { tipo: 'selecionar', indice: i } });
  });

  // --- regras, à direita ---
  const botoes = botoesDeRegra(pedida);
  const xRegras = x + larguraDasLinhas + 16;
  const larguraDoBotao = (AREA.x + AREA.w - MARGEM - xRegras - 8) / 2;
  botoes.forEach((botao, i) => {
    const r: Retangulo = {
      x: xRegras + (i % 2) * (larguraDoBotao + 8),
      y: AREA.y + 66 + Math.floor(i / 2) * 30,
      w: larguraDoBotao,
      h: 24,
    };
    caixa(ctx, r, i === aberto.botao);
    escrever(ctx, botao.rotulo, r.x + r.w / 2, r.y + r.h / 2 + 0.5, { alinhar: 'center', negrito: true });
    regioes.push({ r, acao: { tipo: 'aplicarRegra', botao: i } });
  });
  const sobOCursor = botoes[aberto.botao];
  if (sobOCursor !== undefined) {
    const yDescricao = AREA.y + 66 + Math.ceil(botoes.length / 2) * 30 + 10;
    escrever(ctx, REGRAS[sobOCursor.regra].nome, xRegras, yDescricao, { negrito: true });
    escrever(ctx, REGRAS[sobOCursor.regra].esquema, xRegras, yDescricao + 16, { cor: CORES.textoSecundario });
  }

  if (aberto.recusa !== null) {
    escrever(ctx, aberto.recusa, x, AREA.y + AREA.h - 42, { cor: CORES.perigo });
  }
  rodapeDoDesafio(ctx, '↑↓ linha · E marca · ←→ regra · Enter aplica · Esc volta ao mapa');
  return regioes;
}

/** Desenha o desafio aberto (se houver) e devolve suas regiões clicáveis. */
export function desenharDesafio(ctx: Ctx, estado: Estado): RegiaoClicavel[] {
  const aberto = estado.desafio;
  const definicao = estado.fase.desafios.find((terminal) => terminal.nome === aberto?.nome)?.desafio;
  if (aberto === null || definicao === undefined) return [];
  if (aberto.tipo === 'montagem' && definicao.tipo === 'montagem') return desenharMontagem(ctx, definicao, aberto);
  if (aberto.tipo === 'espelho' && definicao.tipo === 'espelho') return desenharEspelho(ctx, definicao, aberto);
  if (aberto.tipo === 'terminais' && definicao.tipo === 'terminais') return desenharTerminais(ctx, definicao, aberto);
  if (aberto.tipo === 'prova' && definicao.tipo === 'prova') return desenharProva(ctx, definicao, aberto);
  return [];
}
