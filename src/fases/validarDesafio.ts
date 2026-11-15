import { montarFormula, type DefinicaoDoDesafio, type Rodada } from '../jogo/desafios';
import { equivalentes } from '../logica/equivalentes';
import { analisar, ErroDeSintaxe } from '../logica/parser';
import type { ConectivoBinario, Formula } from '../logica/tipos';

export type DesafioLido =
  | { readonly ok: true; readonly desafio: DefinicaoDoDesafio }
  | { readonly ok: false; readonly erros: readonly string[] };

const CONECTIVOS: readonly ConectivoBinario[] = ['AND', 'OR', 'XOR', 'IMP', 'IFF'];

/** Todas as formas de preencher `n` espaços com as opções dadas. */
function preenchimentos(opcoes: readonly ConectivoBinario[], n: number): ConectivoBinario[][] {
  if (n === 0) return [[]];
  return preenchimentos(opcoes, n - 1).flatMap((resto) => opcoes.map((opcao) => [...resto, opcao]));
}

/**
 * Valida a definição de um desafio vinda do JSON da fase. Como o resto do validador,
 * passa tudo pela tabela-verdade: o desafio precisa ter resposta, e ela não pode ser trivial.
 */
export function lerDesafio(item: Record<string, unknown>): DesafioLido {
  const erros: string[] = [];
  const formula = (texto: unknown, onde: string): Formula | null => {
    if (typeof texto !== 'string') {
      erros.push(`${onde} deve ser uma fórmula em texto.`);
      return null;
    }
    try {
      return analisar(texto);
    } catch (erro) {
      if (!(erro instanceof ErroDeSintaxe)) throw erro;
      erros.push(`${onde} ("${texto}") é inválida: ${erro.message}`);
      return null;
    }
  };

  if (item['tipo'] === 'montagem') {
    const alvo = formula(item['alvo'], 'A fórmula-alvo');
    const molde = typeof item['molde'] === 'string' ? item['molde'] : '';
    const descricao = typeof item['descricao'] === 'string' ? item['descricao'] : '';
    const opcoes = (Array.isArray(item['opcoes']) ? item['opcoes'] : []).filter(
      (opcao): opcao is ConectivoBinario => CONECTIVOS.includes(opcao as ConectivoBinario),
    );
    const numeros = [...molde.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]));
    const espacos = numeros.length;
    if (descricao === '') erros.push('Falta a "descricao" do alvo.');
    if (espacos === 0) erros.push('O "molde" precisa de pelo menos um espaço (?1, ?2, …).');
    if ([...numeros].sort().some((n, i) => n !== i + 1)) erros.push('Os espaços do molde devem ser ?1, ?2, … sem repetir.');
    if (opcoes.length < 2) erros.push('"opcoes" precisa de pelo menos duas portas lógicas (AND, OR, XOR, IMP, IFF).');
    if (alvo === null || erros.length > 0) return { ok: false, erros };

    let corretos = 0;
    const todos = preenchimentos(opcoes, espacos);
    for (const escolhas of todos) {
      try {
        const montada = montarFormula(molde, escolhas);
        if (montada !== null && equivalentes(montada, alvo)) corretos++;
      } catch (erro) {
        if (!(erro instanceof ErroDeSintaxe)) throw erro;
        return { ok: false, erros: [`O molde "${molde}" não forma uma fórmula válida: ${erro.message}`] };
      }
    }
    if (corretos === 0) erros.push('Nenhuma montagem do molde reproduz a tabela-verdade do alvo.');
    if (corretos === todos.length) erros.push('Qualquer montagem resolve o desafio: ele é trivial.');
    if (erros.length > 0) return { ok: false, erros };
    return { ok: true, desafio: { tipo: 'montagem', alvo, descricao, molde, espacos, opcoes } };
  }

  if (item['tipo'] === 'espelho') {
    const rodadas: Rodada[] = [];
    const lista = Array.isArray(item['rodadas']) ? item['rodadas'] : [];
    if (lista.length === 0) erros.push('O firewall espelhado precisa de pelo menos uma rodada.');
    lista.forEach((bruta: unknown, i: number) => {
      const rodada = (typeof bruta === 'object' && bruta !== null ? bruta : {}) as Record<string, unknown>;
      const original = formula(rodada['original'], `A fórmula da rodada ${i + 1}`);
      const textos = Array.isArray(rodada['cabos']) ? rodada['cabos'] : [];
      const cabos = textos.map((texto: unknown, c: number) => formula(texto, `O cabo ${c + 1} da rodada ${i + 1}`));
      if (original === null || cabos.some((cabo) => cabo === null)) return;
      const validos = cabos as Formula[];
      if (validos.length < 2) erros.push(`A rodada ${i + 1} precisa de pelo menos dois cabos.`);
      // Exatamente um cabo pode ter a mesma tabela-verdade da fórmula do painel.
      const certos = validos.filter((cabo) => equivalentes(original, cabo)).length;
      if (certos !== 1) {
        erros.push(`A rodada ${i + 1} tem ${certos} cabos equivalentes; deve ter exatamente 1.`);
      }
      rodadas.push({ original, cabos: validos });
    });
    if (erros.length > 0) return { ok: false, erros };
    return { ok: true, desafio: { tipo: 'espelho', rodadas } };
  }

  return { ok: false, erros: [`Tipo de desafio desconhecido: ${JSON.stringify(item['tipo'])}.`] };
}
