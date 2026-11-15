import './estilo.css';
import { ouvirMouse } from './entrada/mouse';
import { comandoDaTecla, ouvirTeclado, type Comando } from './entrada/teclado';
import { carregarFases } from './fases/carregar';
import { aplicar } from './jogo/aplicar';
import { novoEstado } from './jogo/estado';
import {
  carregarProgresso,
  faseLiberada,
  registrarVitoria,
  salvarProgresso,
  type Progresso,
} from './jogo/progresso';
import { circuitoEmFoco } from './jogo/regras';
import type { Estado, Fase, Posicao } from './jogo/tipos';
import { desenharDesafio } from './render/desafios';
import { preencher } from './render/desenho';
import { desenharAviso, desenharBarra, desenharPausa, desenharRodape, desenharVitoria } from './render/hud';
import { ajustarCanvas, TELA, type RegiaoClicavel } from './render/layout';
import { desenharMapa } from './render/mapa';
import { desenharMenu, FASES_POR_LINHA } from './render/menu';
import { desenharDica, desenharPainel } from './render/painelCircuito';
import { desenharScanner } from './render/scanner';
import { ANIMACAO_MS, CORES } from './render/tema';

// Ponto de entrada: junta entrada → jogo → render num laço de requestAnimationFrame.
// Aqui só há navegação entre telas e detalhes visuais; as regras ficam em jogo/.

const DURACAO_DO_AVISO_MS = 2600;

function iniciar(fases: readonly Fase[]): void {
  const canvas = document.getElementById('tela') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  document.body.style.background = CORES.fundoTela;
  ajustarCanvas(canvas, ctx);
  window.addEventListener('resize', () => ajustarCanvas(canvas, ctx));

  const ids = fases.map((fase) => fase.id);
  let progresso: Progresso = carregarProgresso(window.localStorage);
  let tela: 'menu' | 'fase' = 'menu';
  let indice = 0; // fase escolhida no menu / fase em jogo
  let estado: Estado = novoEstado(fases[0] as Fase);
  // Só visual: de onde o hacker está deslizando e desde quando.
  let deslize: { de: Posicao; inicio: number } = { de: estado.jogador, inicio: 0 };
  let aviso: { texto: string; cor: string; ate: number } | null = null;
  // Regiões clicáveis do último quadro desenhado (só existem com um desafio aberto).
  let regioes: RegiaoClicavel[] = [];

  const avisar = (texto: string): void => {
    aviso = { texto, cor: CORES.perigo, ate: performance.now() + DURACAO_DO_AVISO_MS };
  };

  const trocarEstado = (novo: Estado): void => {
    if (novo.evento === 'andou' || novo.evento === 'vitoria') {
      deslize = { de: estado.jogador, inicio: performance.now() };
    } else if (novo.jogador !== estado.jogador) {
      deslize = { de: novo.jogador, inicio: 0 }; // reinício: sem deslizar
    }
    if (novo.evento === 'alerta_estourou') avisar('ALERTA MÁXIMO · seguranças a caminho · fase reiniciada');
    if (novo.evento === 'alarme') avisar('LASER DISPAROU · alarme · fase reiniciada');
    if (novo.evento === 'erro') {
      const motivo = {
        montagem: 'CIRCUITO NÃO EQUIVALENTE',
        espelho: 'CABO NÃO EQUIVALENTE · alarme',
        terminais: 'MARCAÇÃO INCONSISTENTE',
        prova: 'PASSO INVÁLIDO',
      }[novo.desafio?.tipo ?? 'montagem'];
      avisar(`${motivo} · +1 alerta`);
    }
    if (novo.evento === 'vitoria') {
      progresso = registrarVitoria(progresso, novo.fase.id, novo.estrelas);
      salvarProgresso(window.localStorage, progresso);
    }
    estado = novo;
  };

  const abrirFase = (qual: number): void => {
    indice = qual;
    tela = 'fase';
    aviso = null;
    estado = novoEstado(fases[indice] as Fase);
    deslize = { de: estado.jogador, inicio: 0 };
  };

  const comandoNoMenu = (comando: Comando): void => {
    if (comando.tipo === 'mover') {
      const passo = { esquerda: -1, direita: 1, cima: -FASES_POR_LINHA, baixo: FASES_POR_LINHA }[comando.direcao];
      const alvo = indice + passo;
      if (alvo >= 0 && alvo < fases.length) indice = alvo;
    } else if (comando.tipo === 'confirmar' && faseLiberada(ids, progresso, indice)) {
      abrirFase(indice);
    }
  };

  const executar = (comando: Comando): void => {
    if (tela === 'menu') {
      comandoNoMenu(comando);
      return;
    }
    if (comando.tipo === 'confirmar' && estado.desafio === null) {
      if (estado.situacao === 'vitoria' && indice + 1 < fases.length) abrirFase(indice + 1);
      else if (estado.situacao !== 'jogando') tela = 'menu'; // pausado, ou venceu a última fase
      return;
    }
    trocarEstado(aplicar(estado, comando));
  };
  ouvirTeclado(executar);
  ouvirMouse(canvas, () => (tela === 'fase' ? regioes : []), executar);

  // Só em desenvolvimento: ?teclas=Enter,w,w,d,e reproduz uma sequência de teclas ao abrir
  // (para conferir telas e ensaiar a apresentação). Não existe na versão publicada.
  if (import.meta.env.DEV) {
    const parametros = new URLSearchParams(location.search);
    const fase = ids.indexOf(parametros.get('fase') ?? '');
    if (fase >= 0) abrirFase(fase);
    for (const tecla of (parametros.get('teclas') ?? '').split(',')) {
      const comando = comandoDaTecla(tecla);
      if (comando !== null) executar(comando);
    }
  }

  const desenharFase = (agora: number): void => {
    const t = Math.min(1, (agora - deslize.inicio) / ANIMACAO_MS);
    const posicaoVisual: Posicao = {
      x: deslize.de.x + (estado.jogador.x - deslize.de.x) * t,
      y: deslize.de.y + (estado.jogador.y - deslize.de.y) * t,
    };

    preencher(ctx, { x: 0, y: 0, w: TELA.w, h: TELA.h }, CORES.fundoTela);
    desenharBarra(ctx, estado);
    if (estado.desafio !== null) {
      // Desafio aberto: ocupa o lugar do mapa e do painel.
      regioes = desenharDesafio(ctx, estado);
    } else {
      regioes = [];
      desenharMapa(ctx, estado, posicaoVisual);
      const yLivre = desenharPainel(ctx, estado) + 6;
      // Abaixo do circuito: a tabela do Scanner, se este circuito já foi escaneado; senão, a dica.
      const foco = circuitoEmFoco(estado);
      if (foco !== undefined && estado.escaneados.includes(foco.id)) desenharScanner(ctx, estado, foco, yLivre);
      else desenharDica(ctx, estado, yLivre);
      desenharRodape(ctx);
    }

    if (aviso !== null && agora < aviso.ate) desenharAviso(ctx, aviso.texto, aviso.cor, estado.desafio !== null);
    if (estado.situacao === 'vitoria') desenharVitoria(ctx, estado, indice === fases.length - 1);
    if (estado.situacao === 'pausado') desenharPausa(ctx);
  };

  const quadro = (agora: number): void => {
    if (tela === 'menu') desenharMenu(ctx, fases, progresso, indice);
    else desenharFase(agora);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

try {
  iniciar(carregarFases());
} catch (erro) {
  // Fase inválida não entra no jogo: mostra o motivo em vez de uma tela preta.
  const mensagem = document.createElement('pre');
  mensagem.textContent = erro instanceof Error ? erro.message : String(erro);
  mensagem.style.color = CORES.perigo;
  mensagem.style.padding = '16px';
  document.body.replaceChildren(mensagem);
}
