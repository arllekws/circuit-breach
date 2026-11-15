import { valoracaoComPlacas } from '../jogo/regras';
import type { Circuito, Fase, Interruptor, Placa, Posicao, TerminalDeDesafio } from '../jogo/tipos';
import { avaliar } from '../logica/avaliar';
import { minimoTrocas, minimoTrocasSeguro } from '../logica/minimoTrocas';
import { analisar, ErroDeSintaxe } from '../logica/parser';
import type { Restricoes } from '../logica/satisfatibilidade';
import { variaveis } from '../logica/tabelaVerdade';
import type { Bit, Formula } from '../logica/tipos';
import { lerDesafio } from './validarDesafio';

export const LARGURA_MAXIMA = 13;
export const ALTURA_MAXIMA = 11;
/** Mais que isso e a tabela-verdade do Scanner (2ⁿ linhas) não cabe no painel. */
export const MAXIMO_DE_PROPOSICOES_POR_CIRCUITO = 3;

export type ResultadoDaValidacao =
  | { readonly ok: true; readonly fase: Fase; readonly avisos: readonly string[] }
  | { readonly ok: false; readonly erros: readonly string[] };

const ehObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const ehPosicao = (valor: unknown): valor is [number, number] =>
  Array.isArray(valor) && valor.length === 2 && valor.every((n) => Number.isInteger(n));

/**
 * Valida o JSON de uma fase e devolve a fase pronta para o jogo.
 *
 * Além do formato, passa a fase pelo gerador de tabela-verdade:
 *  - toda fórmula precisa ser bem formada e só usar proposições da fase (interruptores e placas);
 *  - nenhum laser pode começar ligado;
 *  - a fase precisa ter solução (satisfatibilidade) alcançável sem disparar laser;
 *  - o mínimo de trocas é CALCULADO aqui, nunca escrito à mão.
 */
export function validarFase(json: unknown): ResultadoDaValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];
  if (!ehObjeto(json)) return { ok: false, erros: ['A fase precisa ser um objeto JSON.'] };

  const texto = (campo: string): string => {
    const valor = json[campo];
    if (typeof valor === 'string' && valor.trim() !== '') return valor;
    erros.push(`Campo "${campo}" ausente ou vazio.`);
    return '';
  };
  const id = texto('id');
  const setor = texto('setor');
  const titulo = texto('titulo');
  const dica = typeof json['dica'] === 'string' ? json['dica'] : '';

  // --- mapa ---
  const linhas = json['mapa'];
  const paredes: boolean[][] = [];
  const caixas: Posicao[] = [];
  let inicio: Posicao | undefined;
  let saida: Posicao | undefined;
  let largura = 0;
  if (!Array.isArray(linhas) || linhas.length === 0 || !linhas.every((l) => typeof l === 'string')) {
    erros.push('Campo "mapa" deve ser uma lista de linhas de texto.');
  } else {
    largura = (linhas[0] as string).length;
    if (largura > LARGURA_MAXIMA || linhas.length > ALTURA_MAXIMA) {
      erros.push(`Mapa maior que ${LARGURA_MAXIMA}×${ALTURA_MAXIMA} células.`);
    }
    (linhas as string[]).forEach((linha, y) => {
      if (linha.length !== largura) erros.push(`Linha ${y} do mapa tem largura diferente das outras.`);
      const fileira: boolean[] = [];
      [...linha].forEach((simbolo, x) => {
        fileira.push(simbolo === '#');
        if (simbolo === '@') {
          if (inicio !== undefined) erros.push('O mapa tem mais de um início (@).');
          inicio = { x, y };
        } else if (simbolo === 'X') {
          if (saida !== undefined) erros.push('O mapa tem mais de uma saída (X).');
          saida = { x, y };
        } else if (simbolo === 'C') {
          caixas.push({ x, y });
        } else if (simbolo !== '#' && simbolo !== '.') {
          erros.push(`Símbolo desconhecido "${simbolo}" no mapa, em (${x}, ${y}).`);
        }
      });
      paredes.push(fileira);
    });
    if (inicio === undefined) erros.push('O mapa não tem início (@).');
    if (saida === undefined) erros.push('O mapa não tem saída (X).');
  }
  const chao = (p: Posicao): boolean => paredes[p.y]?.[p.x] === false;

  // --- entradas (valoração inicial) ---
  const entradas: Record<string, Bit> = {};
  if (!ehObjeto(json['entradas'])) {
    erros.push('Campo "entradas" deve atribuir 0 ou 1 a cada interruptor.');
  } else {
    for (const [nome, valor] of Object.entries(json['entradas'])) {
      if (valor === 0 || valor === 1) entradas[nome] = valor;
      else erros.push(`Entrada ${nome} deve valer 0 ou 1.`);
    }
  }

  // --- interruptores ---
  const ocupadas = new Set<string>();
  const ocupar = (p: Posicao, oQue: string): void => {
    const chave = `${p.x},${p.y}`;
    if (!chao(p)) erros.push(`${oQue} em (${p.x}, ${p.y}) não está sobre o chão do mapa.`);
    if (ocupadas.has(chave)) erros.push(`Mais de um elemento em (${p.x}, ${p.y}).`);
    ocupadas.add(chave);
  };
  if (inicio !== undefined) ocupadas.add(`${inicio.x},${inicio.y}`);
  if (saida !== undefined) ocupadas.add(`${saida.x},${saida.y}`);
  for (const caixa of caixas) ocupadas.add(`${caixa.x},${caixa.y}`);

  const interruptores: Interruptor[] = [];
  const listaInterruptores = Array.isArray(json['interruptores']) ? json['interruptores'] : [];
  listaInterruptores.forEach((item: unknown, i: number) => {
    if (!ehObjeto(item) || typeof item['nome'] !== 'string' || !ehPosicao(item['em'])) {
      erros.push(`Interruptor ${i} mal formado: esperado { "nome": "P", "em": [x, y] }.`);
      return;
    }
    const em = { x: item['em'][0], y: item['em'][1] };
    if (!(item['nome'] in entradas)) {
      erros.push(`Interruptor ${item['nome']} não tem valor inicial em "entradas".`);
    }
    ocupar(em, `Interruptor ${item['nome']}`);
    interruptores.push({ nome: item['nome'], em });
  });
  for (const nome of Object.keys(entradas)) {
    if (!interruptores.some((i) => i.nome === nome)) {
      erros.push(`A proposição ${nome} não tem interruptor no mapa.`);
    }
  }

  // --- placas de pressão: proposições que não têm valor inicial escrito (dependem do mapa) ---
  const placas: Placa[] = [];
  const listaPlacas = Array.isArray(json['placas']) ? json['placas'] : [];
  listaPlacas.forEach((item: unknown, i: number) => {
    if (!ehObjeto(item) || typeof item['nome'] !== 'string' || !ehPosicao(item['em'])) {
      erros.push(`Placa ${i} mal formada: esperado { "nome": "P", "em": [x, y] }.`);
      return;
    }
    const em = { x: item['em'][0], y: item['em'][1] };
    if (item['nome'] in entradas) {
      erros.push(`${item['nome']} é placa de pressão: não pode ter valor em "entradas".`);
    }
    ocupar(em, `Placa ${item['nome']}`);
    placas.push({ nome: item['nome'], em });
  });
  // --- terminais de desafio: proposições que começam em 0 e viram 1 quando o desafio é resolvido ---
  const desafios: TerminalDeDesafio[] = [];
  const listaDesafios = Array.isArray(json['desafios']) ? json['desafios'] : [];
  listaDesafios.forEach((item: unknown, i: number) => {
    if (!ehObjeto(item) || typeof item['nome'] !== 'string' || !ehPosicao(item['em'])) {
      erros.push(`Desafio ${i} mal formado: esperado { "nome": "F", "em": [x, y], "tipo": "..." }.`);
      return;
    }
    const nome = item['nome'];
    if (nome in entradas || placas.some((p) => p.nome === nome)) {
      erros.push(`${nome} é terminal de desafio: não pode ser também interruptor ou placa.`);
    }
    const lido = lerDesafio(item);
    if (!lido.ok) {
      erros.push(...lido.erros.map((erro) => `Desafio ${nome}: ${erro}`));
      return;
    }
    const em = { x: item['em'][0], y: item['em'][1] };
    ocupar(em, `Terminal ${nome}`);
    desafios.push({ nome, em, desafio: lido.desafio });
  });
  const proposicoes = new Set([
    ...Object.keys(entradas),
    ...placas.map((p) => p.nome),
    ...desafios.map((d) => d.nome),
  ]);
  if (proposicoes.size === 0) erros.push('A fase precisa de pelo menos uma proposição.');

  // --- circuitos: portas/pontes (devem dar 1) e lasers (devem dar 0) ---
  const lerCircuitos = (campo: 'portas' | 'lasers'): Circuito[] => {
    const lista = Array.isArray(json[campo]) ? json[campo] : [];
    const circuitos: Circuito[] = [];
    lista.forEach((item: unknown, i: number) => {
      if (!ehObjeto(item) || typeof item['formula'] !== 'string' || !ehPosicao(item['em'])) {
        erros.push(`${campo}[${i}] mal formado: esperado { "em": [x, y], "formula": "..." }.`);
        return;
      }
      const tipo = campo === 'lasers' ? 'laser' : item['tipo'] === 'ponte' ? 'ponte' : 'porta';
      const em = { x: item['em'][0], y: item['em'][1] };
      ocupar(em, `${tipo} "${item['formula']}"`);
      let formula: Formula;
      try {
        formula = analisar(item['formula']);
      } catch (erro) {
        if (!(erro instanceof ErroDeSintaxe)) throw erro;
        erros.push(`Fórmula inválida em ${campo}[${i}] ("${item['formula']}"): ${erro.message}`);
        return;
      }
      const usadas = variaveis(formula);
      for (const nome of usadas) {
        if (!proposicoes.has(nome)) {
          erros.push(`A fórmula "${item['formula']}" usa ${nome}, que não é interruptor nem placa da fase.`);
        }
      }
      if (usadas.length > MAXIMO_DE_PROPOSICOES_POR_CIRCUITO) {
        erros.push(
          `A fórmula "${item['formula']}" usa ${usadas.length} proposições; o máximo por circuito é ${MAXIMO_DE_PROPOSICOES_POR_CIRCUITO}.`,
        );
      }
      circuitos.push({
        id: `${tipo}-${i}`,
        tipo,
        em,
        texto: item['formula'],
        formula,
        opcional: item['opcional'] === true,
      });
    });
    return circuitos;
  };
  const portas = lerCircuitos('portas');
  const lasers = lerCircuitos('lasers');
  if (portas.length === 0) erros.push('A fase precisa de pelo menos uma porta ou ponte.');

  const folgaAlerta = json['folga_alerta'];
  if (typeof folgaAlerta !== 'number' || !Number.isInteger(folgaAlerta) || folgaAlerta < 0) {
    erros.push('Campo "folga_alerta" deve ser um inteiro maior ou igual a 0.');
  }

  if (erros.length > 0 || inicio === undefined || saida === undefined) return { ok: false, erros };

  // --- verificação lógica pelo gerador de tabela-verdade ---
  // Valoração inicial completa: interruptores (do JSON) + placas (pelo que está sobre elas).
  const semDesafios: Record<string, Bit> = { ...entradas };
  for (const terminal of desafios) semDesafios[terminal.nome] = 0;
  const inicial = valoracaoComPlacas(placas, semDesafios, inicio, caixas);
  // Placas não custam troca: são proposições "livres" no cálculo do mínimo.
  // Resolver um desafio também não é troca de interruptor.
  const livres = [...placas.map((p) => p.nome), ...desafios.map((d) => d.nome)];
  const restricoes: Restricoes = {
    // Portas opcionais (ex.: painel corrompido) não fazem parte da solução.
    devemSer1: portas.filter((c) => !c.opcional).map((c) => c.formula),
    devemSer0: lasers.map((c) => c.formula),
  };
  for (const laser of lasers) {
    if (avaliar(laser.formula, inicial)) {
      erros.push(`O laser "${laser.texto}" já começa ligado na valoração inicial.`);
    }
  }
  const hamming = minimoTrocas(inicial, restricoes, livres);
  const seguro = minimoTrocasSeguro(inicial, restricoes, livres);
  if (hamming === null) {
    erros.push('A fase não tem solução: nenhuma valoração abre as portas com os lasers desligados.');
  } else if (seguro === null) {
    erros.push('A fase tem solução, mas não há ordem de trocas que evite disparar um laser.');
  } else if (seguro.trocas !== hamming.trocas) {
    avisos.push(
      `Mínimo seguro (${seguro.trocas}) é maior que a distância de Hamming (${hamming.trocas}): a ordem das trocas obriga um desvio.`,
    );
  }
  if (erros.length > 0 || seguro === null) return { ok: false, erros };

  return {
    ok: true,
    avisos,
    fase: {
      id,
      setor,
      titulo,
      dica,
      largura,
      altura: paredes.length,
      paredes,
      inicio,
      saida,
      entradas: inicial,
      interruptores,
      placas,
      caixas,
      portas,
      lasers,
      desafios,
      folgaAlerta: folgaAlerta as number,
      minimo: seguro.trocas,
    },
  };
}
