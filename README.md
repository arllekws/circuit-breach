# Circuit Breach: O Hacker Lógico

Puzzle 2D de lógica proposicional — Projeto Integrador de Lógica da Computação (CESAR School).
Cada porta, ponte e laser do laboratório é controlado por um circuito, e cada circuito é uma fórmula.

**Jogar:** _link do GitHub Pages entra aqui quando o repositório for publicado._

## Como rodar

```bash
npm install
npm run dev      # abre o jogo em http://localhost:5173
                 # em desenvolvimento: ?fase=3-2 abre direto numa fase
npm test         # testes (Vitest)
npm run tipos    # checagem de tipos (tsc --noEmit)
npm run build    # gera dist/ para publicação
```

Controles: setas/WASD movem · E interage · Q Scanner · R reinicia · Esc pausa · Enter confirma · mouse (ou setas + Enter, e 1/2/3) nos desafios.

**Modo invasão (tecla M):** alterna entre efeitos *desligados* (padrão), *sutis* e *invasão* — chuva de dados nos vazios do mapa, log ao vivo, pulsos nos fios em 1, títulos que se "descriptografam". A escolha fica salva no navegador. **Para apresentar no telão, deixe desligado**: só assim todas as animações ficam dentro do limite de 200 ms.

Na primeira vez na fase 1-1 aparece o **tutorial integrado** (6 passos, não pausa o jogo). Depois da fase 5-2, Enter abre o **relatório final** (estrelas por setor, trocas, alertas e provas, vindos do progresso salvo).

Interface: porte do handoff de design em `design_handoff_circuit_breach/` (tokens em `src/render/tema.ts`, componentes em `src/render/primitivas.ts`).

## Onde está cada conceito de lógica

| Conceito | Código | Teste que prova |
|---|---|---|
| Proposição e fórmula (árvore sintática) | `src/logica/tipos.ts` → `Formula` | `testes/logica/parser.test.ts` |
| Valoração | `src/logica/tipos.ts` → `Valoracao`; `src/jogo/tipos.ts` → `Estado.valoracao` | `testes/jogo/aplicar.test.ts` ("troca o valor da proposição") |
| Conectivos (NOT, AND, OR, XOR, →, ↔) | `src/logica/avaliar.ts` → `avaliar` | `testes/logica/avaliar.test.ts` (um teste por conectivo) |
| Precedência e sintaxe | `src/logica/parser.ts` → `analisar` | `testes/logica/parser.test.ts` |
| Tabela-verdade (2ⁿ valorações) | `src/logica/tabelaVerdade.ts` → `valoracoes`, `tabelaVerdade` | `testes/logica/tabelaVerdade.test.ts` |
| Avaliação de dentro para fora | `src/logica/avaliar.ts` → `avaliarPassoAPasso` | `testes/logica/passoAPasso.test.ts` |
| Tautologia / contradição / contingência | `src/logica/classificar.ts` → `classificar` | `testes/logica/classificarEquivalentes.test.ts` |
| Equivalência (De Morgan, dupla negação, P→Q ≡ ¬P∨Q) | `src/logica/equivalentes.ts` → `equivalentes` | `testes/logica/classificarEquivalentes.test.ts` |
| Satisfatibilidade (portas em 1 e lasers em 0) | `src/logica/satisfatibilidade.ts` → `solucoes`, `satisfativel` | `testes/logica/satisfatibilidadeMinimo.test.ts` (fases 1-1, 3-2, 5-1) |
| Mínimo de trocas (distância de Hamming) | `src/logica/minimoTrocas.ts` → `minimoTrocas`, `minimoTrocasSeguro` | `testes/logica/satisfatibilidadeMinimo.test.ts` |
| Regras de inferência (MP, MT, SH, SD, Simp., Conj., Adição) | `src/logica/inferencia.ts` → `aplicarRegra` | `testes/logica/inferencia.test.ts` (inclui a prova da fase 5-2) |
| Fase verificada pela tabela-verdade | `src/fases/validar.ts` → `validarFase` | `testes/fases/validar.test.ts`, `testes/fases/todasAsFases.test.ts` (zera cada fase) |
| Laser instantâneo (restrição: circuito deve dar 0) | `src/jogo/aplicar.ts` → `interagir`; `src/jogo/regras.ts` → `algumLaserLigado` | `testes/jogo/setores123.test.ts` ("ligar R antes de desligar Q") |
| Placa de pressão como proposição | `src/jogo/regras.ts` → `valoracaoComPlacas` | `testes/jogo/setores123.test.ts` (fase 2-1) |
| Scanner (tabela-verdade com linha atual e linha-alvo) | `src/jogo/scanner.ts` → `tabelaDoScanner` | `testes/jogo/scannerProgresso.test.ts` |
| Equivalência na jogabilidade (Firewall de montagem e espelhado) | `src/jogo/desafios.ts` → `aplicarNoDesafio`, `montarFormula` | `testes/jogo/firewall.test.ts` ("aceita QUALQUER circuito com a mesma tabela-verdade") |
| Tautologia e contradição na jogabilidade (painel sempre ativo / corrompido) | `src/fases/dados/4-1.json`; `src/jogo/scanner.ts` → `classificacao` | `testes/jogo/firewall.test.ts` (fase 4-1) |
| Alerta e estrelas pelo mínimo de trocas | `src/jogo/regras.ts` → `limiteAlerta`, `estrelasPara` | `testes/jogo/aplicar.test.ts` |

O plano do projeto está em [`docs/PLANO.md`](docs/PLANO.md) e o relatório de mecânica em `docs/relatorio-mecanica.pdf`.
