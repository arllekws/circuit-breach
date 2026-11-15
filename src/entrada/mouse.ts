import type { Acao } from '../jogo/tipos';
import { TELA, type RegiaoClicavel } from '../render/layout';

// Mouse: usado nos desafios (Firewall, terminais, Núcleo). O render diz quais retângulos da
// tela são clicáveis e qual ação cada um representa; aqui só se descobre onde foi o clique.

function regiaoSob(evento: MouseEvent, canvas: HTMLCanvasElement, regioes: readonly RegiaoClicavel[]): RegiaoClicavel | undefined {
  // Converte a posição do clique para as coordenadas da tela de referência (680×400).
  const caixa = canvas.getBoundingClientRect();
  const x = ((evento.clientX - caixa.left) * TELA.w) / caixa.width;
  const y = ((evento.clientY - caixa.top) * TELA.h) / caixa.height;
  return regioes.find(({ r }) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export function ouvirMouse(
  canvas: HTMLCanvasElement,
  regioesAtuais: () => readonly RegiaoClicavel[],
  aoClicar: (acao: Acao) => void,
): void {
  canvas.addEventListener('click', (evento) => {
    const regiao = regiaoSob(evento, canvas, regioesAtuais());
    if (regiao !== undefined) aoClicar(regiao.acao);
  });
  canvas.addEventListener('mousemove', (evento) => {
    canvas.style.cursor = regiaoSob(evento, canvas, regioesAtuais()) === undefined ? 'default' : 'pointer';
  });
}
