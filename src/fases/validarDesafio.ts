import {
  montarFormula,
  type DefinicaoDoDesafio,
  type Premissa,
  type ProvaPedida,
  type Rodada,
  type TerminalFalante,
} from '../jogo/desafios';
import { tautologia } from '../logica/classificar';
import { equivalentes } from '../logica/equivalentes';
import { analisar, ErroDeSintaxe } from '../logica/parser';
import { solucoes } from '../logica/satisfatibilidade';
import { variaveis } from '../logica/tabelaVerdade';
import type { ConectivoBinario, Formula } from '../logica/tipos';

export type DesafioLido =
  | { readonly ok: true; readonly desafio: DefinicaoDoDesafio }
  | { readonly ok: false; readonly erros: readonly string[] };

const CONECTIVOS: readonly ConectivoBinario[] = ['AND', 'OR', 'XOR', 'IMP', 'IFF'];

const objeto = (valor: unknown): Record<string, unknown> =>
  (typeof valor === 'object' && valor !== null ? valor : {}) as Record<string, unknown>;

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
      const rodada = objeto(bruta);
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

  if (item['tipo'] === 'terminais') {
    const terminais: TerminalFalante[] = [];
    const lista = Array.isArray(item['terminais']) ? item['terminais'] : [];
    if (lista.length < 2) erros.push('O desafio precisa de pelo menos dois terminais.');
    lista.forEach((bruto: unknown, i: number) => {
      const t = objeto(bruto);
      const lida = formula(t['formula'], `A fórmula do terminal ${i + 1}`);
      if (typeof t['nome'] !== 'string' || typeof t['fala'] !== 'string' || lida === null) {
        erros.push(`Terminal ${i + 1} mal formado: esperado { "nome", "fala", "formula" }.`);
        return;
      }
      // Se A diz φ, a tradução tem que ter a forma A ↔ φ.
      if (lida.tipo !== 'IFF' || lida.a.tipo !== 'VAR' || lida.a.nome !== t['nome']) {
        erros.push(`A fórmula do terminal ${t['nome']} deve ter a forma "${t['nome']} <-> (o que ele diz)".`);
      }
      terminais.push({ nome: t['nome'], fala: t['fala'], formula: lida });
    });
    if (erros.length > 0) return { ok: false, erros };
    const nomes = terminais.map((t) => t.nome);
    const formulas = terminais.map((t) => t.formula);
    for (const usada of variaveis(...formulas)) {
      if (!nomes.includes(usada)) erros.push(`As falas citam ${usada}, que não é um dos terminais.`);
    }
    // Satisfatibilidade: tem que existir exatamente uma marcação que torna tudo verdadeiro.
    const respostas = solucoes({ devemSer1: formulas, devemSer0: [] }, nomes);
    if (respostas.length !== 1) {
      erros.push(`O enigma dos terminais tem ${respostas.length} soluções; deve ter exatamente 1.`);
    }
    if (erros.length > 0) return { ok: false, erros };
    return { ok: true, desafio: { tipo: 'terminais', terminais } };
  }

  if (item['tipo'] === 'prova') {
    const rodadas: ProvaPedida[] = [];
    const lista = Array.isArray(item['rodadas']) ? item['rodadas'] : [];
    if (lista.length === 0) erros.push('O Núcleo precisa de pelo menos uma prova.');
    lista.forEach((bruta: unknown, i: number) => {
      const rodada = objeto(bruta);
      const premissas: Premissa[] = [];
      for (const brutaPremissa of Array.isArray(rodada['premissas']) ? rodada['premissas'] : []) {
        const p = objeto(brutaPremissa);
        const lida = formula(p['formula'], `Uma premissa da prova ${i + 1}`);
        if (lida !== null) premissas.push({ formula: lida, log: typeof p['log'] === 'string' ? p['log'] : '' });
      }
      const meta = formula(rodada['meta'], `A meta da prova ${i + 1}`);
      const adicoes = (Array.isArray(rodada['adicoes']) ? rodada['adicoes'] : [])
        .map((texto: unknown) => formula(texto, `Uma fórmula de adição da prova ${i + 1}`))
        .filter((f): f is Formula => f !== null);
      if (meta === null || premissas.length === 0) {
        erros.push(`A prova ${i + 1} precisa de premissas e de uma meta.`);
        return;
      }
      const conjuncao = premissas.map((p) => p.formula).reduce((acumulada, f) => ({ tipo: 'AND', a: acumulada, b: f }));
      // A conclusão tem que SEGUIR das premissas: (premissas) → meta é tautologia.
      if (!tautologia({ tipo: 'IMP', a: conjuncao, b: meta })) {
        erros.push(`Na prova ${i + 1}, a meta não é consequência lógica das premissas.`);
      }
      // E as premissas não podem se contradizer (senão qualquer coisa seguiria delas).
      if (solucoes({ devemSer1: [conjuncao], devemSer0: [] }).length === 0) {
        erros.push(`Na prova ${i + 1}, as premissas são contraditórias.`);
      }
      rodadas.push({ premissas, meta, adicoes });
    });
    if (erros.length > 0) return { ok: false, erros };
    return { ok: true, desafio: { tipo: 'prova', rodadas } };
  }

  return { ok: false, erros: [`Tipo de desafio desconhecido: ${JSON.stringify(item['tipo'])}.`] };
}
