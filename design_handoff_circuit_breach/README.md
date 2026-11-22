# Handoff: Circuit Breach — redesign da interface (Canvas 2D)

## Visão geral
Redesign completo da interface do jogo **Circuit Breach: O Hacker Lógico** (puzzle 2D de lógica proposicional, navegador, Canvas 2D 680 × 400). Cobre: menu, tela de fase (com dica e com Scanner), feedback de eventos, Firewall (montagem e espelhado), Terminais, Núcleo (prova formal), vitória, tela final (nova), tutorial integrado (novo) e um **modo invasão** opcional com animações ambientes.

## Sobre os arquivos
- `cb-render.js` — **renderer de referência em Canvas 2D puro** (só `fillRect`, `strokeRect`, linhas, `arc`, polígonos e `fillText`). Cada componente é uma função (`panel`, `button`, `val`, `gate`, `circuit`, `truth`, `hud`, `level`, `ent`…). Cada tela é uma função em `S['nome']` que recebe `ctx` e desenha os 680 × 400 lógicos.
- `cb-fx.js` — camada opcional do modo invasão (chuva de dados, log ao vivo, pulsos nos fios, loop de animação).
- `referencia/` — as páginas de apresentação (`.dc.html`) que mostram todas as telas lado a lado com notas de hierarquia. Abra `referencia/Circuit Breach Redesign.dc.html` no navegador (precisa de servidor local por causa dos módulos ES: `npx serve referencia`).

**Importante:** as telas usam **dados fixos de exemplo** (fase 3-2, valores P=1 Q=1 R=0 etc.). A tarefa é **portar o visual para o renderer real do jogo**, alimentando as funções com o estado verdadeiro, **sem alterar regras, fórmulas, controles nem lógica**. As funções de componente podem ser copiadas quase literalmente; as funções de tela servem de molde de layout.

## Fidelidade
**Alta fidelidade.** Cores, tamanhos de fonte, coordenadas e espessuras são finais e estão em px lógicos (680 × 400). O canvas continua sendo escalado proporcionalmente para a janela como já é hoje.

## Restrições preservadas
- Um único `<canvas>` 2D, sem DOM/CSS sobre o jogo, sem imagens nem bibliotecas.
- Fonte monoespaçada em tudo: `"JetBrains Mono", ui-monospace, Menlo, monospace` (pesos 400/700). **Carregue antes do primeiro desenho**: `await document.fonts.load('700 12px "JetBrains Mono"')`. Se não quiser depender do Google Fonts, sirva o .woff2 localmente ou use a fallback.
- Nenhum texto < 11 px. Sem gradiente, sombra, blur ou brilho. Sem piscar.
- Célula do mapa 30 px; mapa máx. 13 × 11.

## Tokens
| Token | Hex | Uso exclusivo |
|---|---|---|
| bg | #0A111A | fundo geral, texto escuro sobre cores cheias |
| map | #0E1621 | fundo do mapa / interior de caixas |
| grid | #162434 | linhas do chão, linha atual da tabela |
| wall | #243447 | parede |
| panel | #101B28 | fundo de painéis |
| border | #2A3E52 | bordas, abas padrão, separadores |
| one | #2DD4BF | **somente** valor lógico 1 (preenchido) |
| zero | #6B8499 | valor 0 (contorno) / texto secundário |
| danger | #E5484D | perigo, alerta, erro, porta trancada, laser |
| ok | #3DD68C | sucesso, meta, linha-alvo, saída |
| amber | #F5B342 | jogador, seleção, foco, estrelas |
| text | #CFE3F2 | texto principal |

Escala tipográfica: 11 (rótulos, meta, tabela), 12 (corpo, botões), 14 (fase no HUD, fórmulas da prova), 18 (fórmula principal), 22–34 (destaques/títulos).

Regra de acessibilidade: nenhum estado depende só da cor — 1 é cheio / 0 é contorno; porta trancada tem barra cruzando, aberta tem duas folhas; ✓/✕; ▸ ATUAL / ◂ ALVO; bloqueado = borda tracejada + cadeado.

## Componentes (px lógicos)
- **Painel** `panel(ctx,x,y,w,h,{v,title,meta})`: fundo #101B28, chanfro 8 px nos cantos sup. dir. e inf. esq., borda 1 px (#2A3E52) ou 2 px em `focus` (âmbar), `danger`, `ok`. Cabeçalho = aba de 16 px de altura no canto sup. esq., texto 11/700, padding 6, ponta inclinada de 8 px; aba padrão #2A3E52 com texto claro, variantes com texto #0A111A. Meta: 11 px alinhado à direita a 12 px da borda, y+9.
- **Botão** `button(...)`: altura 24–30, chanfro 5, texto 12/700 centralizado. Estados: padrão (#0E1621 + borda 1 #2A3E52), selecionado (borda âmbar 2 + prefixo "▸ "), desabilitado (fundo #0A111A, borda tracejada [3,3], texto #6B8499), confirmação (verde cheio, texto #0A111A), perigo (borda vermelha 2, texto vermelho). Tecla opcional à direita (`key`, 16 px de altura).
- **Tecla** `key`: altura 16, largura mín. 16 (texto 11/700 + 8), fundo #0E1621, borda 1 #6B8499 + linha inferior de 1 px (profundidade).
- **Valor** `val(ctx,x,y,v,s)`: quadrado 16/20/26. 1 → #2DD4BF cheio, dígito #0A111A 700. 0 → #0E1621 + contorno #6B8499 (1 px; 2 px se ≥22), dígito #CFE3F2. `?` → tracejado.
- **Entrada** `input`: 40 × 20 = nome (20) | valor (20). Borda ciano se 1, cinza se 0.
- **Porta lógica** `gate`: 92 × 22 (raiz: altura 28, borda 2, chip 20 com dígito 14). Símbolo 14/700 em x+10, nome 11/700 em x+21, chip de resultado à direita. Nomes: NOT ¬, AND ∧, OR ∨, XOR ⊕, IMPLICA →, BICOND ↔. Borda ciano se saída 1, cinza se 0, âmbar se selecionada.
- **Circuito** `circuit(ctx,ox,oy,tree)`: árvore esquerda → direita. Folhas empilhadas a cada 24 px; coluna da porta = altura do nó; x = ox + 40 + 8 + (altura−1) × (92+8). Fios ortogonais com cotovelo 6 px antes da porta; 2 px ciano se 1, 1 px cinza se 0. Entradas da porta em cy ±5 (raiz ±7).
- **Bloco de resultado** `resultBlock`: 250 × 42, chanfro 6, borda verde (saída = meta) ou vermelha. Valor 26 px à esquerda; linha 1 "✓/✕ ESTADO" 12/700 colorido; linha 2 "quanto falta" 11 #6B8499 (ex.: "AND: 1 de 2 entradas em 1" = quantas entradas da porta raiz já estão em 1); "META" + valor à direita.
- **Tabela-verdade** `truth`: linhas de 14 px, colunas de 20 px, texto 11/700 (1 ciano, 0 cinza). Linha-alvo: contorno verde + "◂ ALVO". Linha atual: fundo #162434 + "▸" âmbar + "◂ ATUAL".
- **HUD** `hud`: faixa 680 × 28 #101B28 + linha inferior. Esquerda: "FASE n" 14/700 + "SETOR n · NOME" 11. Centro (x 268): "ALERTA" + 110 px divididos em N segmentos de 11 px de altura (vermelho cheio = usado, contorno = livre) + contador "a/N" (vermelho quando a ≥ N−1). Direita: "POSSÍVEIS" + 3 estrelas r 7,5 (âmbar cheia = ainda conquistável; contorno cinza = perdida na tentativa).
- **Toast / mensagem** `toast`: 24 de altura, chanfro 5, ícone 16 × 16 na cor da variante, texto 11/700.
- **Balão de tutorial** `callout`: borda âmbar 1, aba âmbar "PASSO n/6", texto 12, linha âmbar até o alvo + cantoneiras âmbar (`bracket`).
- **Rodapé de controles** `footer`: teclas + rótulo 11 #6B8499, centralizado em y 380, espaçamento 16.

### Elementos do mapa (`ent`, célula 30)
Interruptor 24 × 24 (nome 11 + dígito 12; cheio se 1). Porta: trancada = moldura vermelha 2 + barra horizontal + chip 0; aberta = duas folhas verdes de 4 px + chip 1. Laser: diamante r11 com borda vermelha + feixe 2 px vermelho com marca a cada célula; desligado = diamante ciano "1" + trilha pontilhada. Ponte: estendida = tábuas verdes a cada 6 px; recolhida = contorno tracejado sobre o vão (hachura diagonal). Placa: dois quadrados concêntricos + chip. Caixa: quadrado com X. Terminal: monitor ">". Saída: quadrado verde tracejado [4,3] + chevron. Jogador: círculo âmbar r9 + ponto de direção; atingido = anel vermelho r13. Ligações: tracejado [3,3], ciano 1,5 px se 1, cinza 1 px se 0.

## Telas (layout em px lógicos)
- **Fase** (`fase`): HUD 0–28 · mapa x8 y34 390 × 338 (nível centralizado verticalmente) · painel do circuito x406 y34 266 × 338 · rodapé y380. Painel: aba "MÓDULO · <ELEMENTO>", fórmula 18/700 em y66, tracejado y84, árvore em (418, 92), resultado em y170, área inferior a partir de y220 = **DICA** (texto 12 + cartões de operador 20 × 20) **ou** **SCANNER** (tabela) **ou** lista de TREINAMENTO no tutorial.
- **Menu** (`S.menu`): coluna esquerda x16–236 (status, título 30/700, subtítulo 14, painel PROGRESSO com estrelas e 10 segmentos de fases, painel âmbar ALVO SELECIONADO com botão INVADIR). Direita: barramento vertical em x266 com nós por setor (verde concluído, âmbar atual, contorno bloqueado), rótulos em x280, cartões 148 × 58 em x360/516, linhas a cada 72 px a partir de y14. Bloqueado: borda tracejada + cadeado + texto cinza.
- **Firewall montagem** (`S.firewall`): painel esquerdo 428 × 338 (ALVO, fórmula 18 com espaços 60 × 28 rotulados "ESP n", árvore viva na linha inspecionada com "≠ ALVO", paleta AND/OR/XOR 124 × 28 com teclas 1/2/3, TESTAR 200 × 30). Painel direito 228 × 338: tabela A B ALVO SEU ✓ (linhas de 32 px, dígitos 16), barra de 4 segmentos, DIAGNÓSTICO.
- **Firewall espelhado** (`S.espelhado`): faixa superior com BANCADA (opcional, teclas 1/2 alternam P/Q só para visualizar), PAINEL ORIGINAL (fórmula 22) e RODADA n DE 4. Dois cabos 328 × 222 lado a lado — cabo 1 ligado por linha contínua, cabo 2 tracejada; selecionado = âmbar.
- **Terminais** (`S.terminais`): linha REGRA no topo; cartões 328 × 262: FALA (14/700), TRADUÇÃO LÓGICA (22/700), legenda 11, botões CONFIÁVEL·1 / COMPROMETIDO·0 com chip de valor e tecla ↑/↓. CONFERIR desabilitado até marcar todos.
- **Núcleo** (`S.nucleo`): painel de prova 440 × 338 — cada linha: checkbox 14 (âmbar marcado), nº, fórmula 14/700, etiqueta PREMISSA ou regra (ex. "SH · 1, 2"), e **log completo quebrado em linhas de 11 px (largura 356)** — sem reticências. Linha sob cursor: fundo #0E1621 + barra âmbar 2 px. Direita: META em painel verde, 8 regras 104 × 24 em 2 colunas, painel da regra com esquema (premissas / traço / ⊢), "REQUER" e "MARCADAS", botão APLICAR.
- **Vitória** (`S.vitoria`): véu rgba(10,17,26,.8) sobre o mapa; painel verde 338 × 212 em (34, 98): "ACESSO LIBERADO" 18 verde, 3 estrelas r13, TROCAS / MÍNIMO / ALERTA, "✓ SOLUÇÃO ÓTIMA" quando trocas = mínimo, botões PRÓXIMA FASE (Enter) e REPETIR (R).
- **Final** (`S.final`): esquerda — "> breach --status", aba verde SISTEMA COMPROMETIDO, título 34, mensagem, estrelas totais + % + barra de 30 células âmbar, painel EQUIPE (Arllesson Gomes, Luan Martins, João Miguel Freitas · Lógica da Computação). Direita — RELATÓRIO DA INVASÃO por setor, TROCAS/ALERTAS/PROVAS, botão VOLTAR AO MENU. Números vêm do save.
- **Tutorial** (`S.tut1..3`, fase 1-1): o painel inferior vira a lista TREINAMENTO (6 passos: ✓ feito, ▸ atual, · pendente). Balões âmbar não pausam o jogo; o passo avança quando a ação acontece (mover → E no interruptor → ler valor → observar circuito → Q Scanner → saída).

## Interações e feedback
- Controles inalterados: setas/WASD, E, Q, R, Esc, Enter (+ 1/2/3 no Firewall, ↑↓ nos terminais/núcleo).
- Transições de estado ≤ 150 ms: porta abre (folhas se afastam), laser desliga (feixe vira pontilhado), ponte estende, alarme (moldura vermelha fixa 1 s + segmento preenchido + toast), atingido (anel vermelho + toast), circuito correto/incorreto (bloco de resultado muda de cor e ícone). Estrelas da vitória entram uma a cada 120 ms.

## Modo invasão (opcional, `cb-fx.js`)
Ativado por `FX.on`/`FX.lvl` (0 limpa, 1 sutil, 2 invasão). Ganchos no renderer: `fx('bg')`, `fx('mapVoid')`, `fx('mapOver')`, `fx('wires')`, `fx('menuBus')`.
- Chuva de dados só em áreas livres (vazios do mapa, metade direita do menu, fundo da tela final com "placas" escuras atrás de cada texto). Colunas de 14 px alternando subida/descida, 8–30 px/s, glifos 11/700 nas cores grid/wall/border. Na fase usa os símbolos da fórmula.
- Log ao vivo no vazio inferior do mapa: uma linha a cada 1,5 s, digitada, empurra as anteriores (11 px, linhas de 13 px).
- Pulsos: quadrados 3 × 3 #CFE3F2 a cada 16 px correndo a 34 px/s só nos fios em 1; ligações do mapa em 1 com `lineDashOffset` animado.
- Títulos descriptografam em 0,7 s; status digitado a 28 car/s com cursor sólido (sem piscar); créditos sobem a 12 px/s no painel EQUIPE.
- Loop limitado a ~30 fps. **Ofereça uma opção para desligar** (telão/apresentação) — isso viola a regra original de ≤ 200 ms.

## Estado necessário (já existe no jogo, só ligar)
Fase/setor, alerta atual e limite, estrelas possíveis, mapa e entidades com valores, fórmula + árvore avaliada (valor de cada nó), elemento focado e meta, Scanner aberto/fechado + linha atual, passo do tutorial, progresso salvo (estrelas por fase, trocas, alertas) para menu e tela final.

## Arquivos
- `cb-render.js` — componentes + telas (referência de implementação).
- `cb-fx.js` — modo invasão.
- `referencia/Circuit Breach Redesign.dc.html` — todas as telas estáticas + notas de hierarquia + spec visual de componentes.
- `referencia/Circuit Breach Hacker.dc.html` — versão animada.
