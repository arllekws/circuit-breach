import type { Acao } from '../jogo/tipos';

// Entrada: traduz teclas em ações do jogo. Não decide regra nenhuma.

/** Ação do jogo, ou "confirmar" (Enter), que navega entre telas. */
export type Comando = Acao | { readonly tipo: 'confirmar' };

const TECLAS: Readonly<Record<string, Comando>> = {
  arrowup: { tipo: 'mover', direcao: 'cima' },
  w: { tipo: 'mover', direcao: 'cima' },
  arrowdown: { tipo: 'mover', direcao: 'baixo' },
  s: { tipo: 'mover', direcao: 'baixo' },
  arrowleft: { tipo: 'mover', direcao: 'esquerda' },
  a: { tipo: 'mover', direcao: 'esquerda' },
  arrowright: { tipo: 'mover', direcao: 'direita' },
  d: { tipo: 'mover', direcao: 'direita' },
  e: { tipo: 'interagir' },
  q: { tipo: 'scanner' },
  r: { tipo: 'reiniciar' },
  escape: { tipo: 'pausar' },
  enter: { tipo: 'confirmar' },
};

/** Setas/WASD movem; E interage; Q usa o Scanner; R reinicia; Esc pausa; Enter confirma. */
export function comandoDaTecla(tecla: string): Comando | null {
  return TECLAS[tecla.toLowerCase()] ?? null;
}

export function ouvirTeclado(aoComando: (comando: Comando) => void): void {
  window.addEventListener('keydown', (evento) => {
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return;
    const comando = comandoDaTecla(evento.key);
    if (comando === null) return;
    evento.preventDefault(); // as setas não rolam a página
    // Segurar a tecla repete só o movimento; as outras ações exigem um novo toque.
    if (evento.repeat && comando.tipo !== 'mover') return;
    aoComando(comando);
  });
}
