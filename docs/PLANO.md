# PLANO — Circuit Breach: O Hacker Lógico

## Contexto

Projeto integrador de Lógica da Computação (CESAR School), equipe de 3. Escopo de lógica aprovado na AV1:
proposições, valorações, conectivos, tabelas-verdade, satisfatibilidade, equivalências e regras de
inferência. Hoje é 14/11/2026, entrega (AV2) ≈ 08/12/2026. Repositório ainda não existe. Objetivo duplo:
jogo jogável no navegador **e** código explicável, em que cada conceito aparece de forma rastreável.

Li o relatório (`Downloads\Circuit Breach — Relatório de Mecânica e Cronograma.pdf`). Diferenças em relação
ao prompt (o prompt prevalece):
- Relatório diz "JavaScript puro"; usaremos **TypeScript strict** (o `avaliar` do relatório fica idêntico, só tipado).
- Relatório previa 12 semanas; temos ~3,5. O cronograma abaixo comprime os Sprints 1–5.
- Do relatório aproveito detalhes que o prompt não traz: desafio 1-2 (`P ∧ Q ∧ ¬R`, folga 0), 2-2 (ponte OR +
  laser XOR dividindo entradas), "menu, tutorial curto e progresso salvo" no MVP, rota alternativa na contradição.

## 1. Decisões de arquitetura

**Stack:** TypeScript strict + Vite + Vitest. Canvas 2D + CSS. Dependências: só `vite`, `typescript`, `vitest`.
Testes rodam em ambiente `node` (sem jsdom) — por isso `logica/`, `jogo/` e `fases/` não tocam em DOM.

**Camadas (cada uma só importa as de baixo):** `logica` ← `jogo` ← `fases` ← `render`/`entrada` ← `main.ts`.

```
circuit-breach/
  index.html
  package.json  tsconfig.json  vite.config.ts      (base: './' → funciona em qualquer nome de repo no Pages)
  .github/workflows/deploy.yml                     (tsc + vitest + build + deploy Pages)
  README.md
  docs/PLANO.md  docs/relatorio-mecanica.pdf
  src/
    main.ts                    loop requestAnimationFrame; telas: menu | fase | vitoria
    estilo.css
    logica/                    PURO
      tipos.ts                 Formula (união discriminada), Valoracao, Bit
      parser.ts                analisar(texto) -> Formula; ErroDeSintaxe com posição
      avaliar.ts               avaliar(f, v); avaliarPassoAPasso(f, v) (valor de cada subfórmula, de dentro p/ fora)
      formatar.ts              formatar(f) -> "¬P ∧ Q"; iguais(a, b) (igualdade estrutural)
      tabelaVerdade.ts         variaveis(f); valoracoes(vars); tabelaVerdade(f)
      classificar.ts           classificar(f) -> 'tautologia' | 'contradicao' | 'contingencia'
      equivalentes.ts          equivalentes(a, b) = mesma tabela-verdade
      satisfatibilidade.ts     solucoes({devemSer1, devemSer0}, vars); satisfativel(...)
      minimoTrocas.ts          minimoTrocas (Hamming) + minimoTrocasSeguro (ver decisão D2)
      inferencia.ts            aplicarRegra(regra, premissas, extra?) -> Formula | ErroDeInferencia
    jogo/                      PURO
      tipos.ts                 Fase, Estado, Acao, Desafio
      estado.ts                novoEstado(fase)
      aplicar.ts               aplicar(estado, acao) -> estado  (único ponto de regra)
      regras.ts                valoracaoAtual, portaAberta, laserLigado, limiteAlerta, estrelas
      desafios.ts              montagem, espelho, terminais, prova (estado + transições)
      progresso.ts             carregar/salvar em um Storage injetado (localStorage em produção)
    fases/
      dados/1-1.json … 5-2.json
      carregar.ts              import.meta.glob eager + validarFase
      validar.ts               validarFase(json) -> Fase | lista de erros (usa logica/)
    render/
      tema.ts                  ÚNICA fonte de cores, fonte e medidas
      layout.ts                retângulos da tela 680×400 e escala
      mapa.ts  hud.ts  painelCircuito.ts  scanner.ts  desafios.ts  menu.ts
    entrada/
      teclado.ts  mouse.ts     eventos -> Acao (mouse usa regiões clicáveis expostas pelo render de desafios)
  testes/                      espelha src/: logica/*.test.ts, jogo/*.test.ts, fases/*.test.ts
```

**Motor lógico**
- `Formula` = `{tipo:'VAR', nome}` | `{tipo:'NOT', a}` | `{tipo:'AND'|'OR'|'XOR'|'IMP'|'IFF', a, b}`;
  `switch` exaustivo com `never` no default (o compilador acusa conectivo esquecido).
- Parser descendente recursivo, uma função por nível de precedência (`iff → imp → ouXor → e → nao → atomo`),
  o que torna a precedência NOT > AND > OR = XOR > `->` > `<->` legível no código. `->` associa à direita;
  os demais à esquerda. Aceita `NOT/AND/OR/XOR/->/<->` (e os símbolos ¬ ∧ ∨ ⊕ → ↔ como sinônimos).
  Erros: símbolo inesperado, parêntese sem par, fórmula vazia, operando faltando — com posição.
- `Valoracao = Record<string, 0 | 1>`.
- Inferência: cada regra é uma função de casamento de padrão sobre árvores usando `iguais`; premissas aceitas
  em qualquer ordem. Simplificação recebe o lado; Adição recebe a fórmula extra.

**Jogo**
- Movimento em grade, célula a célula (estado puro guarda só `{x, y}`; o render interpola ≤ 120 ms).
- `Acao`: `mover(dir)`, `interagir`, `scanner`, `reiniciar`, `pausar`, e ações de desafio (`escolherPorta`,
  `escolherCabo`, `marcarTerminal`, `confirmar`, `aplicarRegra`).
- A cada ação que muda a valoração (interruptor ou placa), `aplicar` recalcula: lasers (qualquer um em 1 →
  alarme → fase reinicia), portas/pontes (aberta ⇔ fórmula = 1; fechada é parede, ponte recolhida é vão).
- Alerta: troca +1, Scanner +2, passo de inferência inválido +1. `alerta > limite` → reinicia.
  `limite = mínimo de trocas + folga_alerta`. Placas e movimento não somam alerta.
- **D1 — Desafios como proposição:** Firewall, terminais e Núcleo são terminais no mapa (tecla E abre a tela
  do desafio no lugar do painel/mapa). Resolver o desafio põe em 1 uma variável (ex.: `F`) que alimenta a
  porta da saída. Assim todos os setores usam o mesmo mecanismo "porta = fórmula que precisa dar 1".
- **D2 — Mínimo de trocas com laser instantâneo:** o relatório define mínimo = distância de Hamming, mas como
  o laser dispara em estados intermediários, a ordem importa. O validador calcula os dois: `minimoTrocas`
  (Hamming, como no relatório) e `minimoTrocasSeguro` (busca em largura sobre valorações, sem passar por
  laser=1). O limite e as estrelas usam o seguro; o validador **reprova** fase sem caminho seguro e avisa se os
  dois diferem. Nas fases de referência os dois coincidem (1-1 = 2, 3-2 = 3).
- **D3 — Placas:** variáveis de placa são livres no cálculo de mínimo (não custam troca); a alcançabilidade
  física (empurrar a caixa) é verificada por teste de jogo com sequência de ações da solução.
- **D4 — Estrelas em desafios sem interruptor (4-2, 5-1, 5-2):** 3 sem erro, 2 com até 2 erros, 1 caso contrário.

**Fase em JSON** (extensão do formato do relatório):
```json
{ "id": "3-2", "setor": "Protocolos", "titulo": "…",
  "mapa": ["#############", "#@..P..Q..R.#", "…"],
  "entradas": {"P": 1, "Q": 1, "R": 0},
  "placas": [], 
  "portas": [{"em": [9,4], "formula": "(P -> Q) AND R", "tipo": "porta"}],
  "lasers": [{"em": [6,6], "formula": "Q AND R"}],
  "desafio": null, "folga_alerta": 3, "dica": "…" }
```
Mapa em texto (máx. 13×11 células de 30 px): `#` parede, `.` chão, `@` início, `X` saída, `C` caixa, `~` vão;
interruptores, placas, portas e lasers posicionados por coordenada. `validarFase` checa: formato, fórmulas
parseiam, toda variável usada existe, lasers em 0 no início, satisfatível, caminho seguro existe, e guarda
`minimo` calculado (nunca escrito à mão no JSON).

**Render:** canvas lógico 680×400 escalado por CSS/`devicePixelRatio`. Barra superior (fase, alerta `n / limite`,
estrelas), mapa à esquerda (~60%), painel do circuito à direita (árvore desenhada das entradas para a lâmpada,
cada porta "NOME · valor", ciano preenchido = 1, contorno = 0), Scanner abaixo, rodapé de controles. Cores só
de `tema.ts`; valor sempre com dígito; texto ≥ 11 px; sem gradiente/sombra/brilho.

## 2. Fases (candidatas — os números finais vêm do validador, não deste texto)

| Fase | Conteúdo | Início | Esperado |
|---|---|---|---|
| 1-1 | porta `NOT P AND Q` | P=1,Q=0 | única P=0,Q=1; 2 trocas; folga 3 |
| 1-2 | porta `P AND Q AND NOT R` | P=0,Q=0,R=1 | 3 trocas; folga 0 |
| 2-1 | ponte `P OR Q` (P = placa com caixa, Q = interruptor); porta `Q XOR R` | tudo 0 | apresenta OR, XOR e placa |
| 2-2 | ponte `Q OR R`; laser `P XOR Q` | tudo 0 | ligar R (1 troca); ligar Q dispara o laser |
| 3-1 | portas `P -> Q` e `Q <-> R` | P=1,Q=0,R=1 | ligar Q (1 troca) |
| 3-2 | porta `(P -> Q) AND R`; laser `Q AND R` | P=1,Q=1,R=0 | única P=0,Q=0,R=1; 3 trocas |
| 4-1 | Firewall de montagem: alvo "1 só com P≠Q", molde com espaços (aceita `P XOR Q` ou `(P OR Q) AND NOT (P AND Q)`); no mapa, painel sempre ativo `P OR NOT P` e painel corrompido `Q AND NOT Q` com rota alternativa | — | aceita qualquer equivalente |
| 4-2 | Firewall espelhado, 3 rodadas: `NOT (P AND Q)`, `NOT NOT P`, `P -> Q`; cada uma com 1 cabo equivalente e 1 não | — | cabo errado = alarme |
| 5-1 | Terminais: `A <-> NOT B`, `B <-> (A <-> B)` | — | A confiável, B comprometido |
| 5-2 | Núcleo: premissas `P -> Q`, `Q -> R`, `NOT R`; meta `NOT P` | — | SH(1,2), MT(4,3) |

## 3. Marcos, datas e tarefas (cada tarefa ≤ 1–2 h, um commit por tarefa, `vitest` + `tsc --noEmit` antes)

### M1 — Motor lógico + testes · 14–16/11 · demonstrável: `npm test` verde
1. Scaffold (package.json, tsconfig strict, vite.config, vitest, .gitignore, PLANO.md) — *pronto:* `npm test` e `npx tsc --noEmit` rodam.
2. `tipos.ts` + `avaliar.ts`, testes primeiro — *pronto:* 1 teste por conectivo contra sua tabela-verdade (7 conectivos).
3. `parser.ts` — *pronto:* testes de precedência, associatividade de `->`, parênteses, símbolos, e 5+ erros com mensagem.
4. `formatar.ts` (`formatar`, `iguais`) — *pronto:* `analisar(formatar(f))` é igual a `f` para os casos de teste.
5. `tabelaVerdade.ts` — *pronto:* tabela de `NOT P AND Q` bate com a do relatório; 2ⁿ linhas para n = 1..4.
6. `classificar.ts` + `equivalentes.ts` — *pronto:* `P OR NOT P` tautologia, `Q AND NOT Q` contradição; De Morgan (2 leis), dupla negação, `P -> Q ≡ NOT P OR Q`; `NOT P AND NOT Q` **não** equivale a `NOT (P AND Q)`.
7. `satisfatibilidade.ts` + `minimoTrocas.ts` — *pronto:* 1-1 → única solução, mínimo 2; 3-2 → única solução, mínimo 3, e o caminho "R antes de Q" é rejeitado pelo seguro; caso insatisfatível retorna vazio.
8. `avaliarPassoAPasso` — *pronto:* devolve subfórmulas em ordem de dentro para fora com valores (base do painel e do Scanner).
9. `inferencia.ts` (MP, MT, SH primeiro; depois SD, Simplificação, Conjunção, Adição) — *pronto:* cada regra com 1 caso válido e 1 inválido; prova da 5-2 validada passo a passo; 5-1 resolvida por `solucoes`.

### M2 — Jogo mínimo: fase 1-1 do início ao fim · 17–19/11 · jogável e já publicado
1. `jogo/tipos.ts`, `novoEstado`, mover com colisão — *pronto:* testes de movimento/parede.
2. Interagir com interruptor, alerta, porta abre/fecha, vitória, estrelas — *pronto:* teste "1-1 resolvida em 2 trocas = 3 estrelas"; "estourar alerta reinicia".
3. `fases/validar.ts` + `carregar.ts` + `1-1.json` — *pronto:* teste carrega 1-1 e confirma mínimo 2; JSON inválido gera erro legível.
4. `tema.ts`, `layout.ts`, `index.html`, `estilo.css`, loop em `main.ts` — *pronto:* tela 680×400 escalada, fundo e molduras.
5. `render/mapa.ts` — *pronto:* paredes, interruptores com letra e dígito, porta, saída tracejada, hacker, linhas tracejadas interruptor→porta.
6. `render/painelCircuito.ts` — *pronto:* circuito da 1-1 acende/apaga em tempo real.
7. `render/hud.ts` + `entrada/teclado.ts` + reinício (R) — *pronto:* 1-1 jogável do início à tela de vitória.
8. Workflow do GitHub Pages — *pronto:* link público abre a 1-1 (precisa do repositório remoto; ver perguntas).

### M3 — Setores 1–3 (6 fases) · 20–24/11
1. Scanner (ação + `render/scanner.ts`, linha atual ciano, linhas-alvo verde, +2 alerta) — *pronto:* teste de alerta; visual conferido na 1-1.
2. Vários circuitos por fase + painel mostra o elemento mais próximo — *pronto:* teste com 2 portas.
3. Lasers (derrota instantânea, alarme ≤ 200 ms, reinício) — *pronto:* teste "3-2: R antes de Q reinicia; ordem certa vence com 3 estrelas".
4. Caixas e placas de pressão, pontes — *pronto:* testes empurrar caixa, placa 1/0, ponte recolhe quando volta a 0.
5. Fases 1-2, 2-1, 2-2, 3-1, 3-2 (uma tarefa por fase) — *pronto:* cada uma passa no validador e tem teste de jogo com a sequência de ações da solução.
6. Menu de fases + progresso em localStorage + avanço automático — *pronto:* teste de `progresso.ts` com Storage falso; recarregar a página mantém estrelas.
7. Pausa (Esc) e tutorial curto (dica textual por fase no rodapé/painel) — *pronto:* visível nas fases 1-1 a 3-2.

### M4 — Firewall (Setor 4) · 25–28/11
1. Desafio de montagem em `jogo/desafios.ts` (molde com espaços, escolher porta por clique, confirmar = `equivalentes`) — *pronto:* testes aceitam as duas montagens do relatório e recusam uma errada.
2. `render/desafios.ts` (montagem) + `entrada/mouse.ts` — *pronto:* montar por clique, tabela-alvo ao lado da tabela atual.
3. Painéis sempre ativo/corrompido rotulados via `classificar` + fase 4-1 — *pronto:* validador e teste de jogo.
4. Firewall espelhado (3 rodadas, cabo errado = alarme) + fase 4-2 — *pronto:* teste garante exatamente 1 cabo equivalente por rodada.

### M5 — Núcleo Central (Setor 5) · 29/11–02/12
1. Desafio de terminais (marcar confiável/comprometido, conferir com `solucoes`) + fase 5-1 — *pronto:* só A=1,B=0 é aceito.
2. Desafio de prova: estado (linhas numeradas, regra, premissas), passo inválido recusado e +1 alerta — *pronto:* teste da prova SH(1,2), MT(4,3); passo inválido não entra na lista.
3. UI da prova (escolher regra, clicar nas linhas, linha nova com justificativa) + fase 5-2 — *pronto:* jogo zerável do início ao fim.
4. Tela final com total de estrelas.

### M6 — Polimento, README, publicação · 03–06/12 (07/12 de folga; 08/12 entrega)
1. README: como rodar, link, tabela "conceito → arquivo/função → teste" (preenchida a partir dos testes reais).
2. Playtest com colegas (meta do relatório: 5) e correções; ajuste de folgas de alerta.
3. Revisão de acessibilidade (dígitos, contraste, texto ≥ 11 px, projeção).
4. Só se sobrar tempo: sons, arrastar e soltar, arte.

## 4. Plano de testes

- **logica/** (maior cobertura): conectivos × tabela-verdade; parser (precedência, associatividade, erros);
  equivalências nomeadas; classificação; satisfatibilidade e mínimos das fases de referência; cada regra de
  inferência válida/inválida; provas completas.
- **jogo/**: `aplicar` como função pura — movimento, colisão, interruptores de mesma letra, alerta e limite,
  estrelas (0, +2, +3 trocas extras), laser instantâneo, placas/caixas, vitória, cada desafio.
- **fases/**: um teste percorre **todos** os JSON: valida, exige solução e caminho seguro, e executa a
  sequência de ações da solução esperando vitória com 3 estrelas. Fase sem esse teste não entra.
- **render/ e entrada/**: sem teste unitário (sem DOM). Verificação manual no navegador ao fim de cada marco,
  com checklist curto no PLANO (painel acende, Scanner destaca, textos legíveis).
- CI: `tsc --noEmit` + `vitest run` + `vite build` em cada push; deploy só com tudo verde.

## 5. Riscos e ordem de corte

| Risco | Mitigação |
|---|---|
| Prazo 3× menor que o do relatório | Marcos sempre jogáveis; publicação já no M2; 07/12 de folga |
| Desenho do circuito no canvas (layout da árvore) | Layout fixo por profundidade; fórmulas das fases têm ≤ 3 níveis |
| Scanner com 4 variáveis (16 linhas) não cabe com texto ≥ 11 px | Fases com no máx. 3 variáveis por circuito; se precisar, Scanner ocupa o painel inteiro |
| UI de prova/Firewall consumir tempo | Tudo por clique; lógica testada antes da UI |
| Fase sem solução ou com solução insegura | Validador na carga + teste que percorre todos os JSON |
| Integração entre 3 pessoas | Camadas com fronteira clara; commits pequenos; README como roteiro |

**Ordem de corte (aviso antes de cortar):** (1) Modo Infinito, editor, ranking, arte final, sons — já fora do
plano; (2) arrastar e soltar (fica clique) e terminais 5-1; (3) Núcleo reduzido a MP, MT e SH — inferência
nunca é eliminada.

## 6. Perguntas em aberto (nenhuma bloqueia o M1)

1. **Repositório remoto:** você cria o repositório no GitHub e me passa a URL, ou quer que eu crie com `gh`? Nome sugerido: `circuit-breach`. Preciso disso só no fim do M2.
2. **D2:** tudo bem o limite de alerta usar o mínimo *seguro* (respeitando a ordem por causa do laser), mantendo o Hamming do relatório como função separada e explicável?
3. **Estrela bônus da tautologia** (relatório): proponho não criar 4ª estrela; passar pela porta sempre ativa sem mexer em nada já é o caminho de 3 estrelas da 4-1. Ok?
4. **Estrelas nos desafios** (D4: por número de erros) — ok?
5. A data da AV2 (08/12) está confirmada no calendário oficial? Haverá vídeo de demonstração/relatório final que eu deva considerar no M6?
6. Os outros dois integrantes vão programar em paralelo? Se sim, sugiro que peguem fases (JSON) e playtest, que não conflitam com o motor.

## Verificação (fim de cada marco)

`npx tsc --noEmit` · `npx vitest run` · `npm run build` · `npm run dev` e jogar as fases do marco no
navegador (checando painel em tempo real, Scanner, alerta, estrelas) · a partir do M2, conferir o link do Pages.

## Registro de mudanças em relação ao plano

- **14/11 — M1, M2 e M3 concluídos** (motor lógico, fase 1-1, Setores 1–3 com 6 fases, Scanner, menu e progresso).
- Interruptores são **sólidos**: o jogador encosta e aperta E (a letra e o dígito ficam sempre visíveis). O interruptor que E vai trocar ganha contorno âmbar.
- Emissores de laser também são sólidos; o laser é uma restrição global (dispara quando a fórmula dá 1), não um feixe no mapa.
- **Scanner cobra 2 de alerta uma vez por circuito**; depois disso a tabela daquele circuito fica visível sempre que ele está em foco. Scanner não conta como troca (não tira estrela).
- Pontes ocupam uma célula e se comportam como portas (com desenho próprio); caixas não entram em porta/ponte nem na saída.
- Máximo de **3 proposições por circuito** (validado), para a tabela do Scanner (2³ = 8 linhas) caber no painel com texto ≥ 11 px. A fase pode ter mais proposições no total.
- Fase 2-1: mínimo **0 trocas** (a solução de 3 estrelas usa só a placa); usar o interruptor Q dá 2 estrelas.
- Teste `todasAsFases` usa um **solucionador** (busca em largura sobre `aplicar`) que prova que cada fase é zerável no mapa com o mínimo de trocas — no lugar de sequências de teclas escritas à mão.
- Sem extensão do navegador disponível, a conferência visual é feita por capturas de tela do Chrome sem janela, usando `?fase=` e `?teclas=` (só em desenvolvimento).
- **M4 concluído** (Firewall): desafios são terminais no mapa cuja proposição (ex.: `F`) vira 1 ao resolver, como previsto em D1.
- Montagem por **clique** (escolhe o espaço, escolhe a porta) e também por teclado (setas + Enter). Arrastar e soltar fica fora, conforme a ordem de corte.
- No Firewall de montagem as proposições são `A` e `B` (não `P`, `Q`) para não confundir com os interruptores do mapa.
- Firewall espelhado tem **4 rodadas** (as duas leis de De Morgan, dupla negação, P → Q ≡ ¬P ∨ Q). Cabo errado = alarme: +1 alerta, 1 erro e volta à rodada 1 (não reinicia a fase inteira, para as estrelas por erro fazerem sentido).
- Porta com `"opcional": true` (painel corrompido) fica fora do cálculo de solução.
- Estrelas: erros em desafios contam como trocas extras (`estrelasPara(trocas, minimo, erros)`), o que implementa D4.
- `entrada/mouse.ts` importa só o tipo `RegiaoClicavel` e o tamanho da tela de `render/layout.ts`.
