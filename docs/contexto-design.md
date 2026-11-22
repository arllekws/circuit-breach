# Circuit Breach: O Hacker Lógico — contexto para redesenho da interface

## O que é

Puzzle 2D visto de cima, jogado no navegador do PC. O jogador é um hacker preso num laboratório e escapa abrindo portas, desligando lasers e estendendo pontes. Cada um desses elementos é controlado por um circuito, e cada circuito é uma fórmula da lógica proposicional (NOT, AND, OR, XOR, →, ↔). O elemento muda de estado quando a fórmula dá o valor certo.

É um projeto de faculdade (disciplina Lógica da Computação). Público: estudantes do ensino médio e iniciantes em computação. A interface também vai ser **projetada num telão** durante a apresentação ao professor. Por isso precisa ser legível de longe e deixar o raciocínio lógico visível.

## Restrições técnicas (não mudam)

- Tudo é desenhado num **único `<canvas>` 2D**, com resolução lógica de **680 × 400** escalada para a janela. Não há HTML/CSS por cima do jogo. O redesenho precisa ser implementável com retângulos, linhas, círculos e texto.
- Sem bibliotecas de UI, sem imagens obrigatórias. Pixel art só entra se sobrar tempo.
- **Fonte monoespaçada** em todo o jogo. Nenhum texto menor que 11 px (na escala 680 × 400).
- Formas chapadas: **sem gradiente, sombra, brilho ou blur**. Animações de no máximo 200 ms, sem piscar.
- O mapa usa células de 30 px, no máximo 13 × 11 células.

## Linguagem visual: a cor sempre tem significado lógico

| Papel | Cor | Uso |
|---|---|---|
| Fundo da tela | `#0A111A` | |
| Fundo do mapa | `#0E1621` | |
| Grade do chão | `#162434` | |
| Parede | `#243447` | |
| Painel | `#101B28`, borda `#2A3E52` | |
| **Valor 1 (aceso)** | ciano `#2DD4BF`, preenchido | interruptor ligado, porta lógica em 1, fio que leva 1 |
| **Valor 0 (apagado)** | contorno `#6B8499`, fundo escuro | |
| **Perigo** | vermelho `#E5484D` | laser, alarme, porta trancada, passo inválido |
| **Sucesso** | verde `#3DD68C` | saída, porta aberta, resultado certo, linha-alvo do Scanner |
| **Jogador e estrelas** | âmbar `#F5B342` | também usado para "o que está selecionado agora" |
| Texto principal | `#CFE3F2` | |
| Texto secundário | `#6B8499` | |

Regra de acessibilidade: **nunca indicar valor só pela cor**. O dígito 0/1 aparece sempre, ou o valor é marcado por preenchido × contorno.

## Controles

Setas/WASD movem. E interage (troca interruptor, abre terminal). Q aciona o Scanner. R reinicia. Esc pausa. Enter confirma.

Nos desafios funcionam mouse (clique) **e** teclado. Não existe arrastar e soltar.

## Telas atuais

As capturas estão em `docs/telas/`.

1. **Menu** (`01-menu.png`): título, total de estrelas, grade de fases (uma linha por setor, 2 fases por linha). Cada fase mostra o título e 3 estrelas, ou aparece "bloqueada".
2. **Tela de fase** (`02`, `03`, `04`). É a tela principal.
   - **Barra superior:** "Fase 1-1 · Acesso", barra de ALERTA segmentada com "n / limite", e 3 estrelas (as que o jogador ainda leva).
   - **Mapa à esquerda** (~60% da largura):
     - parede, chão em grade e saída (quadrado tracejado verde);
     - hacker: círculo âmbar com um ponto indicando a direção;
     - interruptor: quadrado com a letra e o dígito. É sólido: o jogador encosta e aperta E;
     - porta: vermelha com 0 quando trancada, batentes verdes com 1 quando aberta;
     - ponte: tábuas verdes quando estendida, vão vermelho tracejado quando recolhida;
     - placa de pressão: moldura tracejada com letra e dígito;
     - caixa: bloco com X;
     - emissor de laser: losango vermelho;
     - terminal de desafio: um "monitor" com letra e dígito;
     - linhas tracejadas finas ligam cada entrada aos circuitos que ela alimenta.
   - **Painel do circuito à direita.** **É o destaque da tela.** Mostra o circuito do elemento mais próximo do jogador:
     - fórmula em texto (ex.: `(P → Q) ∧ R`);
     - árvore desenhada da esquerda para a direita: entradas, portas lógicas ("IMP·1", "AND·0") e lâmpada de saída;
     - linha de situação ("SAÍDA = 0 · PORTA TRANCADA").
   - **Abaixo do circuito:** a dica da fase ou, depois do Scanner, a **tabela-verdade**. A linha atual vem em faixa ciano com ">"; as linhas-alvo vêm contornadas em verde com "◄ alvo".
   - **Rodapé:** dica de teclas.
   - **Sobreposições:** aviso vermelho ("LASER DISPAROU · fase reiniciada"), pausa, e vitória (estrelas, trocas × mínimo).
3. **Firewall · montagem** (`05`). Ocupa mapa + painel. À esquerda, um circuito com espaços vazios (`(A [?] B) [?] ¬(A [?] B)`), as portas para encaixar (AND, OR, XOR) e o botão TESTAR. À direita, uma tabela-verdade com as colunas alvo × seu (verde "=" / vermelho "≠").
4. **Firewall espelhado** (`06`): fórmula do painel em cima, dois "cabos" (fórmulas candidatas) embaixo. Só o equivalente passa. São 4 rodadas.
5. **Terminais** (`07`): 2 ou 3 cartões. Cada cartão mostra a fala do terminal, a tradução lógica (`A ↔ ¬B`) e os botões CONFIÁVEL · 1 / COMPROMETIDO · 0. Há um botão para conferir a marcação.
6. **Núcleo Central** (`08`): prova formal. À esquerda, as linhas numeradas (premissas com o "log" do sistema; linhas novas com a regra usada) com caixa de marcação. À direita, os botões das regras (MP, MT, SH, SD, SIMP esq./dir., CONJ, AD), o nome e o esquema da regra selecionada, e a META em verde.
7. **Vitória** (`09`): caixa sobre o mapa com estrelas, trocas e mínimo.

## Problemas que eu vejo hoje (onde quero ajuda)

- **Espaço mal usado.**
  - Mapas pequenos ficam com faixas vazias em volta.
  - O Núcleo e a montagem do Firewall têm muito espaço vazio embaixo.
  - O menu ocupa só a metade de cima da tela.
- **Painel do circuito:**
  - a árvore funciona, mas parece "diagrama de prova", não um painel de segurança hackeável;
  - os rótulos "IMP·1" e "AND·0" são pouco claros;
  - falta deixar óbvio *o que* o elemento precisa (1 ou 0) e *quanto falta*.
- **HUD:**
  - a barra de alerta usa cinza claro, que não tem significado lógico;
  - não fica claro que as estrelas do topo são "as que você ainda leva";
  - não há legenda de que ciano = 1.
- **Hierarquia:** tudo tem mais ou menos o mesmo peso visual; o olho não sabe para onde ir primeiro.
- **Texto truncado:** os logs do Núcleo terminam em "…".
- **Falta:**
  - tela final do jogo (total de estrelas, créditos);
  - tutorial curto na primeira fase (hoje só há uma dica em texto);
  - feedback mais claro quando uma porta abre ou um laser dispara (sem efeitos de brilho).
- **Identidade:** quero mais cara de "terminal de hacker / laboratório de segurança". Isso deve vir da paleta, da fonte, de molduras e de rótulos estilo console, não de sprites.

## O que eu quero de você

1. Propor um redesenho das telas acima (prioridade: **tela de fase com painel do circuito**, depois Núcleo, Firewall, menu e vitória), respeitando as restrições e a paleta.
2. Em cada tela, mostrar a hierarquia: o que o jogador lê primeiro, segundo e terceiro.
3. Sugerir um sistema de componentes reutilizáveis (moldura de painel, botão, caixa de valor 0/1, porta lógica, linha de tabela) com medidas em px na escala 680 × 400, para eu reimplementar no Canvas.
4. Manter: os dígitos 0/1 sempre visíveis; o significado de cada cor; o painel do circuito como destaque; tudo legível num projetor.

Não mude regras do jogo nem conceitos de lógica. O foco é só apresentação.
