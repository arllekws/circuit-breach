import './estilo.css';
import './render/modoInvasao';
import { ouvirMouse } from './entrada/mouse';
import { comandoDaTecla, ouvirTeclado, type Comando } from './entrada/teclado';
import { carregarFases } from './fases/carregar';
import { aplicar } from './jogo/aplicar';
import { novoEstado } from './jogo/estado';
import {
  carregarEstatisticas,
  carregarProgresso,
  faseLiberada,
  registrarResultado,
  registrarVitoria,
  salvarEstatisticas,
  salvarProgresso,
  type Estatisticas,
  type Progresso,
} from './jogo/progresso';
import { limiteAlerta, portaAberta } from './jogo/regras';
import { avancarTutorial, novoTutorial, type Tutorial } from './jogo/tutorial';
import type { Estado, Fase, Posicao } from './jogo/tipos';
import { variaveis } from './logica/tabelaVerdade';
import type { Bit } from './logica/tipos';
import { telaBoot } from './render/boot';
import { telaDeDesafio } from './render/desafios';
import { FX, fx, type NivelDeEfeitos } from './render/efeitos';
import { rotuloDoCircuito, telaDeFase } from './render/fase';
import { telaFinal } from './render/final';
import { ajustarCanvas, TELA, type Aviso, type RegiaoClicavel, type Visual } from './render/layout';
import { desenharMenu, FASES_POR_LINHA } from './render/menu';
import { rectF } from './render/primitivas';
import { ANIMACAO_MS, C, fonteCarregada } from './render/tema';

// Ponto de entrada: junta entrada → jogo → render num laço de requestAnimationFrame.
// Aqui só há navegação entre telas e detalhes visuais; as regras ficam em jogo/.

const CHAVE_DOS_EFEITOS = 'circuit-breach:efeitos';
const NOMES_DOS_EFEITOS = ['DESLIGADOS', 'SUTIS', 'INVASÃO'] as const;

function carregarNivelDeEfeitos(): NivelDeEfeitos {
  try {
    const salvo = Number(window.localStorage.getItem(CHAVE_DOS_EFEITOS));
    return salvo === 1 || salvo === 2 ? salvo : 0;
  } catch {
    return 0;
  }
}

function iniciar(fases: readonly Fase[]): void {
  const canvas = document.getElementById('tela') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  document.body.style.background = C.bg;
  ajustarCanvas(canvas, ctx);
  window.addEventListener('resize', () => ajustarCanvas(canvas, ctx));

  const ids = fases.map((fase) => fase.id);
  let progresso: Progresso = carregarProgresso(window.localStorage);
  let estatisticas: Estatisticas = carregarEstatisticas(window.localStorage);
  let tela: 'boot' | 'menu' | 'fase' | 'final' = 'boot';
  let indice = 0; // fase escolhida no menu / fase em jogo
  let estado: Estado = novoEstado(fases[0] as Fase);
  FX.nivel = carregarNivelDeEfeitos();

  // Só apresentação: nada disto muda regra.
  let deslize: { de: Posicao; inicio: number } = { de: estado.jogador, inicio: 0 };
  const mudancas = new Map<string, number>();
  let aviso: Aviso | null = null;
  let alarmeAte = 0;
  let vitoriaEm = 0;
  let tutorial: Tutorial | null = null;
  let bancada: Record<string, Bit> = {};
  let regioes: RegiaoClicavel[] = [];

  const avisar = (variante: Aviso['variante'], icone: string, texto: string, duracao = 1800): void => {
    aviso = { variante, icone, texto, ate: performance.now() + duracao };
  };

  const trocarEstado = (novo: Estado): void => {
    const agora = performance.now();
    if (novo.evento === 'andou' || novo.evento === 'vitoria') {
      deslize = { de: estado.jogador, inicio: agora };
    } else if (novo.jogador !== estado.jogador) {
      deslize = { de: novo.jogador, inicio: 0 }; // reinício: sem deslizar
    }
    // Portas e pontes que mudaram de estado: anima a transição e avisa quando abrem.
    const reinicio = novo.evento === 'reinicio' || novo.evento === 'alarme' || novo.evento === 'alerta_estourou';
    if (reinicio) mudancas.clear();
    else {
      const abertas: string[] = [];
      for (const porta of novo.fase.portas) {
        const antes = portaAberta(estado, porta);
        const depois = portaAberta(novo, porta);
        if (antes === depois) continue;
        mudancas.set(porta.id, agora);
        if (depois) abertas.push(`${rotuloDoCircuito(porta, novo.fase)} ${porta.tipo === 'ponte' ? 'ESTENDIDA' : 'ABERTA'}`);
      }
        if (abertas.length > 0) avisar('ok', '✓', `${abertas.join(' // ')} // output=1`);
    }
    switch (novo.evento) {
      case 'troca':
        // O aviso de porta aberta (mais importante) não é apagado pelo de alerta.
        if (aviso === null || agora >= aviso.ate || aviso.variante !== 'ok') {
          avisar('default', '>', `ALERTA +1 // ${novo.alerta}/${limiteAlerta(novo.fase)}`, 1200);
        }
        break;
      case 'scanner':
        avisar('default', '>', 'SCAN EXECUTADO // truth-table [+2 ALERTA]');
        break;
      case 'alarme':
        alarmeAte = agora + 1000;
        avisar('danger', 'X', 'INTRUSION DETECTED // laser trigger -> reset', 2400);
        break;
      case 'alerta_estourou':
        alarmeAte = agora + 1000;
        avisar('danger', '!', 'ALERTA MAXIMO // trace iniciado -> reset', 2400);
        break;
      case 'erro': {
        const motivo = {
          montagem: 'CIRCUITO NAO EQUIVALENTE',
          espelho: 'CABO NAO EQUIVALENTE // alarme',
          terminais: 'MARCACAO INCONSISTENTE',
          prova: 'PASSO INVALIDO',
        }[novo.desafio?.tipo ?? 'montagem'];
        avisar('danger', '!', `${motivo} // +1 ALERTA ${novo.alerta}/${limiteAlerta(novo.fase)}`, 2400);
        break;
      }
      case 'desafio_resolvido': {
        const nome = estado.desafio?.nome ?? '';
        avisar('ok', '✓', `TERMINAL ${nome} UNLOCKED // ${nome}=1`, 2400);
        break;
      }
      case 'vitoria':
        vitoriaEm = agora;
        progresso = registrarVitoria(progresso, novo.fase.id, novo.estrelas);
        salvarProgresso(window.localStorage, progresso);
        estatisticas = registrarResultado(estatisticas, novo.fase.id, {
          estrelas: novo.estrelas,
          trocas: novo.trocas,
          minimo: novo.fase.minimo,
          alerta: novo.alerta,
          erros: novo.erros,
        });
        salvarEstatisticas(window.localStorage, estatisticas);
        break;
      default:
        break;
    }
    if (tutorial !== null) tutorial = avancarTutorial(tutorial, novo);
    estado = novo;
  };

  const abrirFase = (qual: number): void => {
    indice = qual;
    tela = 'fase';
    aviso = null;
    alarmeAte = 0;
    mudancas.clear();
    bancada = {};
    estado = novoEstado(fases[indice] as Fase);
    deslize = { de: estado.jogador, inicio: 0 };
    // Tutorial integrado: na 1-1, enquanto ela nunca foi vencida.
    tutorial = estado.fase.id === ids[0] && (progresso[estado.fase.id] ?? 0) === 0 ? novoTutorial() : null;
  };

  const trocarEfeitos = (): void => {
    FX.nivel = ((FX.nivel + 1) % 3) as NivelDeEfeitos;
    FX.t0 = FX.t;
    try {
      window.localStorage.setItem(CHAVE_DOS_EFEITOS, String(FX.nivel));
    } catch {
      // Sem armazenamento: a escolha vale só nesta sessão.
    }
    avisar('default', 'i', `EFEITOS ${NOMES_DOS_EFEITOS[FX.nivel]} · tecla M`);
  };

  const comandoNoMenu = (comando: Comando): void => {
    if (comando.tipo === 'mover') {
      const passo = { esquerda: -1, direita: 1, cima: -FASES_POR_LINHA, baixo: FASES_POR_LINHA }[comando.direcao];
      const alvo = indice + passo;
      if (alvo >= 0 && alvo < fases.length) indice = alvo;
    } else if (comando.tipo === 'selecionar') {
      if (comando.indice >= 0 && comando.indice < fases.length) indice = comando.indice;
    } else if (comando.tipo === 'confirmar' && faseLiberada(ids, progresso, indice)) {
      abrirFase(indice);
    }
  };

  /** 1/2/3 nos desafios: escolhem a porta no Firewall ou alternam a bancada do espelhado. */
  const atalhoNumerico = (n: number): void => {
    const aberto = estado.desafio;
    const definicao = estado.fase.desafios.find((t) => t.nome === aberto?.nome)?.desafio;
    if (aberto?.tipo === 'montagem' && definicao?.tipo === 'montagem') {
      const porta = definicao.opcoes[n - 1];
      if (porta !== undefined) trocarEstado(aplicar(estado, { tipo: 'escolherPorta', espaco: aberto.cursor, porta }));
    } else if (aberto?.tipo === 'espelho' && definicao?.tipo === 'espelho') {
      const rodada = definicao.rodadas[aberto.rodada];
      const nome = rodada === undefined ? undefined : variaveis(rodada.original, ...rodada.cabos)[n - 1];
      if (nome !== undefined) bancada = { ...bancada, [nome]: (bancada[nome] ?? 1) === 1 ? 0 : 1 };
    }
  };

  const executar = (comando: Comando): void => {
    if (comando.tipo === 'efeitos') {
      trocarEfeitos();
      return;
    }
    if (tela === 'boot') {
      if (comando.tipo === 'confirmar') tela = 'menu';
      return;
    }
    if (tela === 'menu') {
      comandoNoMenu(comando);
      return;
    }
    if (tela === 'final') {
      if (comando.tipo === 'confirmar') tela = 'menu';
      if (comando.tipo === 'reiniciar') FX.t0 = FX.t; // rever créditos
      return;
    }
    if (comando.tipo === 'numero') {
      atalhoNumerico(comando.n);
      return;
    }
    if (comando.tipo === 'confirmar' && estado.desafio === null) {
      if (estado.situacao === 'vitoria') {
        if (indice + 1 < fases.length) abrirFase(indice + 1);
        else tela = 'final';
      } else if (estado.situacao === 'pausado') tela = 'menu';
      return;
    }
    trocarEstado(aplicar(estado, comando));
  };
  ouvirTeclado(executar);
  ouvirMouse(canvas, () => regioes, executar);

  // Só em desenvolvimento: ?fase=3-2&teclas=w,w,d,e abre uma fase e reproduz teclas;
  // ?tela=final abre o relatório; ?efeitos=0|1|2 escolhe o modo invasão.
  if (import.meta.env.DEV) {
    const parametros = new URLSearchParams(location.search);
    const telaParam = parametros.get('tela');
    if (telaParam === 'final' || telaParam === 'menu' || telaParam === 'boot') tela = telaParam;
    const fase = ids.indexOf(parametros.get('fase') ?? '');
    if (fase >= 0) abrirFase(fase);
    const efeitos = parametros.get('efeitos');
    if (efeitos === '0' || efeitos === '1' || efeitos === '2') FX.nivel = Number(efeitos) as NivelDeEfeitos;
    for (const tecla of (parametros.get('teclas') ?? '').split(',')) {
      const comando = comandoDaTecla(tecla);
      if (comando !== null) executar(comando);
    }
  }

  let nomeDaTela = '';
  const quadro = (agora: number): void => {
    FX.t = agora / 1000;
    const nome = tela === 'fase' ? `fase:${estado.fase.id}:${estado.desafio?.tipo ?? ''}:${estado.situacao}` : tela;
    if (nome !== nomeDaTela) {
      nomeDaTela = nome;
      FX.t0 = FX.t; // títulos "descriptografam" a cada tela nova
    }
    FX.tela = tela;
    rectF(ctx, 0, 0, TELA.w, TELA.h, C.bg);

    if (tela === 'boot') regioes = telaBoot(ctx);
    else if (tela === 'menu') regioes = desenharMenu(ctx, fases, progresso, indice);
    else if (tela === 'final') regioes = telaFinal(ctx, fases, progresso, estatisticas);
    else {
      const t = Math.min(1, (agora - deslize.inicio) / ANIMACAO_MS);
      const visual: Visual = {
        agora,
        jogador: {
          x: deslize.de.x + (estado.jogador.x - deslize.de.x) * t,
          y: deslize.de.y + (estado.jogador.y - deslize.de.y) * t,
        },
        mudancas,
        aviso,
        alarmeAte,
        vitoriaEm,
        tutorial,
        bancada,
        ultimaFase: indice === fases.length - 1,
      };
      regioes = estado.desafio !== null ? telaDeDesafio(ctx, estado, visual) : telaDeFase(ctx, estado, visual);
    }
    fx('overlay', ctx);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

void (async () => {
  try {
    const fases = carregarFases();
    await fonteCarregada();
    iniciar(fases);
  } catch (erro) {
    // Fase inválida não entra no jogo: mostra o motivo em vez de uma tela preta.
    const mensagem = document.createElement('pre');
    mensagem.textContent = erro instanceof Error ? erro.message : String(erro);
    mensagem.style.color = C.danger;
    mensagem.style.padding = '16px';
    document.body.replaceChildren(mensagem);
  }
})();
