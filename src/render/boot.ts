import { FX, fx } from './efeitos';
import { TELA, type RegiaoClicavel } from './layout';
import { button, chamfer, footer, panel, rectF, T, TX, TY, type Ctx } from './primitivas';
import { C } from './tema';

const LINHAS = [
  '> [BOOT] CIRCUIT_BREACH_OS v0.1.0',
  '> [OK] kernel lógico carregado',
  '> [OK] módulos: NOT AND OR XOR IMP IFF',
  '> [SCAN] LAB-07 // 5 setores detectados',
  '> [WARN] firewall ativo · acesso restrito',
  '> [READY] operador autenticado: HACKER',
  '> digite ENTER para iniciar invasão_',
];

export function telaBoot(ctx: Ctx): RegiaoClicavel[] {
  fx('fundo', ctx, 'boot');
  rectF(ctx, 0, 0, TELA.w, TELA.h, C.bg);
  panel(ctx, 56, 34, 568, 300, { v: 'focus', title: 'TERMINAL // LAB-07', meta: 'SECURE SHELL' });
  TX(ctx, 'CIRCUIT', 80, 78, { size: 30, bold: true }, 0.05);
  TX(ctx, 'BREACH', 80, 110, { size: 30, bold: true, color: C.term }, 0.2);
  T(ctx, 'O Hacker Lógico', 80, 134, { size: 12, color: C.dim });
  chamfer(ctx, 80, 150, 520, 150, 6, C.map, C.border, 1);

  const t = Math.max(0, FX.t - FX.t0);
  const visiveis = FX.ligado ? Math.min(LINHAS.length, Math.floor(t / 0.35) + 1) : LINHAS.length;
  for (let i = 0; i < visiveis; i++) {
    const linha = LINHAS[i] ?? '';
    const digitando = FX.ligado && i === visiveis - 1 && visiveis < LINHAS.length;
    const texto = digitando ? linha.slice(0, Math.floor((t % 0.35) / 0.03)) : linha;
    const cor = linha.includes('[WARN]') ? C.danger : linha.includes('[READY]') ? C.ok : linha.includes('[OK]') ? C.term : C.text;
    T(ctx, texto, 96, 172 + i * 18, { size: 11, color: i === LINHAS.length - 1 ? C.amber : cor });
    if (digitando) rectF(ctx, 96 + texto.length * 6.6, 166 + i * 18, 7, 12, C.term);
  }

  const pronto = !FX.ligado || visiveis >= LINHAS.length;
  const entrar = { x: 270, y: 316, w: 140, h: 28 };
  if (pronto) button(ctx, entrar.x, entrar.y, entrar.w, entrar.h, 'INICIAR', 'confirm', { key: 'Enter' });
  else TY(ctx, ['aguardando boot...'], 340, 330, { size: 11, color: C.dim, align: 'center' }, Infinity, 18);
  footer(ctx, [['Enter', 'iniciar'], ['M', 'efeitos']]);
  return pronto ? [{ r: entrar, acao: { tipo: 'confirmar' } }] : [];
}
