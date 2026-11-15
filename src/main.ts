import './estilo.css';
import { comandoDaTecla, ouvirTeclado, type Comando } from './entrada/teclado';
import { carregarFases } from './fases/carregar';
import { aplicar } from './jogo/aplicar';
import { novoEstado } from './jogo/estado';
import type { Estado, Fase, Posicao } from './jogo/tipos';
import { preencher } from './render/desenho';
import { desenharAviso, desenharBarra, desenharPausa, desenharRodape, desenharVitoria } from './render/hud';
import { ajustarCanvas, TELA } from './render/layout';
import { desenharMapa } from './render/mapa';
import { desenharDica, desenharPainel } from './render/painelCircuito';
import { ANIMACAO_MS, CORES } from './render/tema';

// Ponto de entrada: junta entrada → jogo → render num laço de requestAnimationFrame.

const DURACAO_DO_AVISO_MS = 2600;

function iniciar(fases: readonly Fase[]): void {
  const canvas = document.getElementById('tela') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  document.body.style.background = CORES.fundoTela;
  ajustarCanvas(canvas, ctx);
  window.addEventListener('resize', () => ajustarCanvas(canvas, ctx));

  let indice = 0;
  let estado: Estado = novoEstado(fases[indice] as Fase);
  // Só visual: de onde o hacker está deslizando e desde quando.
  let deslize: { de: Posicao; inicio: number } = { de: estado.jogador, inicio: 0 };
  let aviso: { texto: string; cor: string; ate: number } | null = null;

  const trocarEstado = (novo: Estado): void => {
    if (novo.evento === 'andou' || novo.evento === 'vitoria') {
      deslize = { de: estado.jogador, inicio: performance.now() };
    } else if (novo.jogador !== estado.jogador) {
      deslize = { de: novo.jogador, inicio: 0 }; // reinício: sem deslizar
    }
    if (novo.evento === 'alerta_estourou') {
      aviso = {
        texto: 'ALERTA MÁXIMO · seguranças a caminho · fase reiniciada',
        cor: CORES.perigo,
        ate: performance.now() + DURACAO_DO_AVISO_MS,
      };
    }
    estado = novo;
  };

  const executar = (comando: Comando): void => {
    if (comando.tipo === 'confirmar') {
      if (estado.situacao !== 'vitoria') return;
      indice = (indice + 1) % fases.length;
      trocarEstado(novoEstado(fases[indice] as Fase));
      return;
    }
    trocarEstado(aplicar(estado, comando));
  };
  ouvirTeclado(executar);

  // Só em desenvolvimento: ?teclas=w,w,d,e reproduz uma sequência de teclas ao abrir
  // (para conferir telas e ensaiar a apresentação). Não existe na versão publicada.
  if (import.meta.env.DEV) {
    const teclas = new URLSearchParams(location.search).get('teclas') ?? '';
    for (const tecla of teclas.split(',')) {
      const comando = comandoDaTecla(tecla);
      if (comando !== null) executar(comando);
    }
  }

  const quadro = (agora: number): void => {
    const t = Math.min(1, (agora - deslize.inicio) / ANIMACAO_MS);
    const posicaoVisual: Posicao = {
      x: deslize.de.x + (estado.jogador.x - deslize.de.x) * t,
      y: deslize.de.y + (estado.jogador.y - deslize.de.y) * t,
    };

    preencher(ctx, { x: 0, y: 0, w: TELA.w, h: TELA.h }, CORES.fundoTela);
    desenharBarra(ctx, estado);
    desenharMapa(ctx, estado, posicaoVisual);
    const yLivre = desenharPainel(ctx, estado);
    desenharDica(ctx, estado, yLivre + 6);
    desenharRodape(ctx);

    if (aviso !== null && agora < aviso.ate) desenharAviso(ctx, aviso.texto, aviso.cor);
    if (estado.situacao === 'vitoria') desenharVitoria(ctx, estado, indice === fases.length - 1);
    if (estado.situacao === 'pausado') desenharPausa(ctx);

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
