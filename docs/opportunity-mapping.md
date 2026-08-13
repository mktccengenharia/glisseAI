# Mapeamento de Oportunidades de Melhoria — Glisse AI (RAG CBHPM)

**Version:** 1.1.0
**Status:** Draft
**Owner:** @pm (Morgan)
**Date:** 2026-08-12
**Last updated:** 2026-08-13 (seção 6 — triagem do brainstorm de zero custo)
**Baseline:** Estado atual do `main` (commit `13dcf7c`) vs. `docs/prd.md` v1.0.0

---

## Método

Este mapeamento cruza três fontes: (1) o que o PRD v1.0.0 prometeu, (2) o que está de fato implementado no código hoje, e (3) lacunas de produto que o PRD não cobria. Cada item traz evidência (arquivo/linha), impacto no negócio, esforço estimado e prioridade (RICE simplificado: Alto/Médio/Baixo).

---

## 1. Gaps críticos vs. PRD v1.0.0

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 1.1 | **Cobertura de dados incompleta** — apenas Capítulos 1, 2 e 3 da CBHPM foram parseados e importados. A tabela CBHPM tem mais capítulos (procedimentos clínicos, exames complementares etc.) que hoje não existem no banco. | `scripts/cbhpm-import/lib/` só tem `parse-cap1/2/3.mjs`; `parse-cap3.mjs` trata "CAPÍTULO 4" apenas como delimitador de fim, não como conteúdo a extrair. | **Alto** — usuário busca um procedimento fora do Cap. 1-3 e o sistema simplesmente não encontra, sem sinalizar "capítulo ainda não importado" (parece bug, não limitação conhecida). Mina a confiança do setor de cobrança logo na adoção. | Médio (replicar padrão dos parsers existentes por capítulo) | **Alto** |

> **Atualização 2026-08-12 (Story 1.4):** resolvido por completo. A CBHPM tem só 4 capítulos no total (confirmado no próprio texto-fonte, não havia "Capítulo 5" a descobrir) — Capítulo 4 (Procedimentos Diagnósticos e Terapêuticos) foi parseado e importado nas 7 edições depois que o usuário forneceu os PDFs-fonte. Foi mais complexo que os Capítulos 1-3: o Capítulo 4 tem 6 esquemas de coluna diferentes por subseção (ECG/exames simples = 2 colunas; endoscopia = +auxiliar; procedimentos invasivos = +auxiliar+anestésico igual ao Cap. 3; Radiologia = +custo de filme+incidências; Medicina Nuclear = +custo de filme+UR). Exigiu extração via `pdftotext -table` em vez de `-layout` (que desalinhava porte/valor entre linhas) e 3 colunas novas no schema (`custo_filme_doc`, `numero_incidencias`, `unidade_radiofarmaco`). "UR" (Unidade de Radiofármaco) quase sempre aparece como `*` na fonte — confirmado no texto da própria CBHPM que isso remete a uma tabela de preços EXTERNA do Colégio Brasileiro de Radiologia, não a um valor presente no documento; gravado como texto bruto, nunca inventado.
| 1.2 | **Busca é 100% textual (`ILIKE`), não híbrida** — FR-01 do PRD pede busca estruturada + semântica com embeddings/fuzzy match; hoje é regex + `ILIKE` sobre `codigo`/`procedimento`. | `src/app/api/search/route.js` | **Alto** — termos técnicos parciais, sinônimos ou erros de digitação do faturista não retornam nada. É a segunda user story do PRD ("busca com minhas próprias palavras") e não está atendida. | Médio-Alto (pgvector + embeddings, ou fuzzy search com `pg_trgm` como passo intermediário mais barato) | **Alto** |

> **Atualização 2026-08-12 (Story 1.2 + 1.3):** resolvido em duas camadas — full-text search em português (índice já existente) e busca semântica com embeddings open source (`Xenova/multilingual-e5-small`, rodando localmente, sem API externa). Falta só aplicar a migration e rodar o backfill (ver seção de status abaixo).
| 1.3 | **Sem importador administrável (FR-05)** — carga de novas edições é uma pipeline de 10 scripts CLI numerados, com gate humano manual (`APPROVED.txt`), sem UI. | `scripts/cbhpm-import/01-*.mjs` a `10-*.mjs` | **Médio** — funcional para quem já sabe rodar Node, mas não escala para "Gestor de Cobrança" (persona do PRD) atualizar tabelas sozinho. | Alto (UI de upload + validação) | **Médio** — só vale a pena se o ritmo de novas edições justificar |
| 1.4 | **Nenhuma métrica de sucesso está instrumentada** — PRD define metas (tempo médio de consulta, taxa de erro, adoção) mas não há como medi-las hoje. | Sem analytics/logging estruturado em `package.json`; único log é `console.error` pontual | **Alto** — impossível provar que o produto entrega os 80% de ganho de produtividade prometido, ou saber se a adoção está de fato em 100% em 2 semanas. | Baixo (Vercel Analytics/PostHog + eventos de busca) | **Alto** |

---

## 2. Confiabilidade e risco operacional

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 2.1 | **Zero testes automatizados** — o único teste existente foi removido junto com código morto; não há framework de teste instalado. | `tests/` vazio; nenhum `jest`/`vitest` em `package.json`; `AGENTS.md` referencia `npm test` que não existe como script | **Alto** — este é um sistema de precisão financeira ("100% determinístico" é a promessa central do PRD); sem testes de regressão, um erro de parsing ou de query pode devolver porte/valor errado sem ninguém notar. | Médio (testes de contrato para `/api/search` e `/api/chat`, testes de snapshot dos parsers) | **Alto** |
| 2.2 | **Sem rate limiting nas rotas de API** | `src/app/api/chat/route.js`, `src/app/api/search/route.js` — sem middleware de limite | **Médio** — exposição a custo inesperado na Groq API e a abuso, já que a rota de chat aceita POST livremente. | Baixo (rate limit por IP/sessão) | **Médio** |
| 2.3 | **Sem CI/CD** — nenhum pipeline automatizado valida build/lint antes de merge. | Sem `.github/workflows` | **Médio** — cada `git push` para `main` vai direto para produção sem gate automático (o merge fast-forward desta sessão, por exemplo, não passou por nenhum check). | Baixo (GitHub Actions: lint + build) | **Médio** |
| 2.4 | **Nenhum controle de acesso** — app está publicamente acessível sem autenticação, apesar do NFR do PRD pedir "acesso corporativo restrito". | Sem middleware de auth, sem página de login | **Médio-Alto** — depende de onde a URL de produção é exposta; se pública, dados de precificação interna do hospital/operadora ficam visíveis a qualquer um com o link. | Médio (SSO corporativo ou senha simples + Vercel password protection como paliativo) | **Alto** (se a URL já é pública) |

> **Atualização 2026-08-12:** um gate de senha simples foi implementado e testado na Story 1.2, e em seguida removido a pedido explícito do stakeholder — decisão de manter a URL aberta. O risco descrito acima permanece real e é aceito conscientemente; não é mais tratado como pendência de implementação.

---

## 3. Produto e experiência do usuário

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 3.1 | **Sem feedback do usuário sobre respostas da LLM** — nenhum mecanismo de "essa resposta ajudou?". | Não há componente de feedback em `page.jsx` | **Médio** — sem isso, a equipe não descobre alucinações ou respostas ruins até um erro de faturamento acontecer. É o sinal mais barato de qualidade contínua para um produto que promete 100% de precisão. | Baixo (thumbs up/down + log da query) | **Alto** |
| 3.2 | **Histórico de conversa não persiste** — perdido a cada reload de página. | `messages` em `useState` local, sem storage | **Baixo-Médio** — faturista que precisa comparar múltiplos procedimentos na mesma sessão perde contexto ao atualizar a página. | Baixo (localStorage) a Médio (histórico por usuário no Supabase, se houver auth) | **Baixo** |
| 3.3 | **Sem sinalização de "capítulo não coberto ainda"** — relacionado a 1.1: quando a busca não encontra nada, a UI não diferencia "não existe na CBHPM" de "ainda não importamos esse capítulo". | `page.jsx` fluxo de busca sem resultados | **Médio** — mina confiança do usuário sem necessidade; uma mensagem honesta ("Capítulo X ainda não disponível") é mais barata que resolver 1.1 por completo e já mitiga o dano de imagem. | Muito baixo | **Alto** (quick win, complementa 1.1) |

> **Atualização 2026-08-13 (triagem do brainstorm, seção 6.4):** o item **3.2 passa a incluir também consultas recentes e favoritos**, absorvendo o ZC-10 do brainstorm do @analyst. Escopo revisado: "persistência no cliente — conversa, consultas recentes e favoritos, em localStorage". Mesmo mecanismo, mesmo arquivo, mesmo teste; manter duas entradas produziria duas stories que se atropelam. Prioridade segue **Baixa**.

---

## 4. Ruído técnico / limpeza

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 4.1 | `.env.example` traz chaves genéricas do template AIOX não usadas pelo Glisse AI (DeepSeek, OpenRouter, Sentry, N8N, Railway, ClickUp). | `.env.example` | **Baixo** — confunde quem for configurar o projeto do zero. | Muito baixo | **Baixo** |
| 4.2 | Componentes `src/components/ui/button.jsx` e `input.jsx` e `src/lib/utils.js` (`cn()`) existem mas não são usados pelo fluxo real (`page.jsx` define os próprios inline). | Achado do levantamento | **Baixo** | Muito baixo | **Baixo** |

---

## Sequenciamento recomendado

**Quick wins (1 sprint, alto impacto/baixo esforço):**
1. Instrumentar analytics básico de uso e de buscas sem resultado (4→1.4)
2. Mensagem honesta de "capítulo ainda não coberto" em vez de silêncio (3.3)
3. Feedback thumbs up/down por resposta (3.1)
4. Rate limiting nas rotas de API (2.2)

**Próximo horizonte (decisão estratégica necessária):**
5. Completar cobertura dos capítulos CBHPM restantes (1.1) — depende de quais capítulos o setor de cobrança realmente usa no dia a dia; recomendo validar com o usuário-piloto antes de investir no parsing completo.
6. Evoluir busca textual para híbrida/semântica (1.2) — só compensa depois que 1.1 estiver resolvido, senão melhora a busca sobre dados incompletos.
7. Definir modelo de controle de acesso (2.4) — depende de onde a URL será hospedada; se ficar atrás de VPN/rede interna, prioridade cai.

**Investimento estrutural (justifica-se com tração comprovada):**
8. Suite de testes automatizados + CI/CD (2.1, 2.3)
9. Importador administrável para novas edições CBHPM (1.3)

---

## Decisões confirmadas pelo stakeholder (2026-08-12)

- **URL é pública.** Item 2.4 (controle de acesso) deixa de ser hipótese e passa a **crítico/urgente** — há dados de precificação interna expostos sem autenticação em produção.
- **Meta de cobertura: todos os capítulos da CBHPM**, não apenas os mais usados. Item 1.1 confirmado como objetivo estratégico de escopo total, não parcial.
- **Já há piloto rodando em produção** com os capítulos existentes. Isso muda o cálculo de risco dos itens 2.1/2.3 (testes/CI): não é mais "investimento estrutural para depois de tração comprovada" — a tração já existe e cada consulta real sem rede de proteção é exposição financeira ativa. **Reclassificados para Alto.**

## 5. Feedback do piloto em produção (usuário, 2026-08-12)

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 5.1 | **Busca semântica** — reconfirma o item 1.2; usuário validou em uso real que buscas por termo parcial/sinônimo falham. | — | **Alto** | Médio-Alto | **Alto** (mantém posição no sequenciamento) |
| 5.2 | **Copiar código ou nome do procedimento isoladamente** — hoje o botão "Copiar" do `ProcedureCard` só copia o bloco inteiro (`Código: X \| Procedimento: Y \| Porte: Z`); não há como copiar apenas um campo. | `src/app/page.jsx:99-105` (`copyToClipboard`), `:171-178` (botão único) | **Médio** — no fluxo real de faturamento, o operador frequentemente só precisa colar o código OU o nome no sistema de destino, não o bloco todo. | Baixo (botões de copiar por campo, mantendo o "copiar tudo" atual) | **Alto** (quick win, feedback direto do usuário-piloto) |
| 5.3 | **Melhor organização das respostas do chat** — a resposta da LLM hoje é texto corrido; o `systemPrompt` não define nenhuma estrutura de formatação (listas, seções, hierarquia) para a síntese em linguagem natural. | `src/app/api/chat/route.js:66-83` (systemPrompt sem regra de formatação/estrutura) | **Médio** — resposta mal estruturada aumenta o tempo de leitura, contra o objetivo do PRD de resposta "clara e amigável". | Baixo (adicionar regra explícita de formatação ao systemPrompt) | **Alto** |
| 5.4 | **Proibir travessões longos (—) nas respostas** — usuário reporta que o caractere "suja" o texto. Hoje não há nenhuma regra no `systemPrompt` proibindo o uso, e o próprio prompt (instruções internas, não visível ao usuário) usa `—` livremente, então não é surpresa que o modelo o reproduza na saída. | `src/app/api/chat/route.js:22-25,72,80` (uso de `—` nas instruções do prompt) | **Baixo-Médio** — qualidade percebida da resposta, não correção factual. | Muito baixo (uma linha de regra no systemPrompt: "nunca use travessão (—); prefira frases curtas ou vírgula") | **Alto** (trivial, resolve incômodo direto do usuário) |

Nota: o caractere `—` também aparece como valor de fallback visual no `ProcedureCard` (`page.jsx:109-115,153,159`, ex. quando um campo não consta na fonte) — isso é uma convenção de UI diferente da reclamação do usuário (que é sobre o texto gerado pela LLM), mas vale alinhar se a intenção for eliminar o caractere da interface como um todo.

---

## Status de implementação (2026-08-12, Story 1.2)

Implementado nesta sessão, sem dependências externas ausentes:

| Item | Status | Nota |
|---|---|---|
| 2.2 Rate limiting | ✅ Feito | `src/lib/rate-limit.js`, aplicado em `/api/chat`, `/api/search`, `/api/auth/login` |
| 2.4 Controle de acesso | ❌ Revertido a pedido do usuário (2026-08-12) | Implementado e testado, depois removido: decisão explícita de manter a URL aberta. Risco de exposição de dados de precificação segue registrado e aceito conscientemente pelo stakeholder |
| 5.3/5.4 Formatação + sem travessão | ✅ Feito (Story 1.1) | — |
| 5.2 Copiar código/nome isolados | ✅ Feito (Story 1.1) | — |
| 1.2 Busca full-text (parcial) | ✅ Feito (Story 1.2) | Usa `to_tsvector('portuguese', ...)` já indexado |
| 1.2/5.1 Busca semântica (embeddings) | ✅ Feito e ativo em produção (Story 1.3) | `Xenova/multilingual-e5-small` via `@huggingface/transformers`, rodando localmente na função serverless. Migration aplicada e backfill rodado (2026-08-12): 16.902 procedimentos com embedding. Testado ao vivo: "tirar próstata" encontra "Eletrovaporização de próstata" / "Ressecção endoscópica da próstata" |
| 3.3 Mensagem de capítulo não coberto | ✅ Feito | `/api/search` retorna `coveredChapters`, UI monta a mensagem |
| 3.1 Feedback thumbs up/down | ✅ Feito (código) — ⚠️ Migration pendente | Precisa rodar seção 10 de `supabase/schema.sql` no SQL Editor |
| 1.4 Analytics de buscas sem resultado | ✅ Feito (código) — ⚠️ Migration pendente | Precisa rodar seção 11 de `supabase/schema.sql` no SQL Editor |
| 2.1 Testes automatizados | ✅ Feito | `vitest`, 20 testes, `npm test` |
| 2.3 CI/CD | ✅ Feito | `.github/workflows/ci.yml` (lint + test + build) |
| 1.1 Cobertura completa da CBHPM (Capítulo 4) | ✅ Feito e ativo em produção (Story 1.4) | Usuário forneceu os PDFs-fonte (`C:\...\tabelas_cbhpm\`). Confirmado: a CBHPM só tem 4 capítulos no total — cobertura agora é 100%. 13.682 procedimentos do Capítulo 4 importados nas 7 edições (94,3% com porte determinado; o resto entrou como stub pesquisável, mesmo padrão já usado no Cap. 3). Banco: 30.584 procedimentos no total |

**Ação pendente do usuário para ativar 100% do que foi implementado:**
1. Rodar as seções 10 e 11 de `supabase/schema.sql` no SQL Editor do Supabase (tabelas `chat_feedback` e `search_events`) — busca semântica (seção 12) e cobertura do Capítulo 4 (seção 13) já estão aplicadas e ativas desde 2026-08-12

Fora do sprint por decisão de sequenciamento (não é bloqueio técnico):

| Item | Motivo |
|---|---|
| 1.3 Importador administrável | Só compensa com mais tração de novas edições — decisão de priorização, não bloqueio |

---

## Sequenciamento recomendado (revisado)

**Sprint imediato (produção já está em uso — risco ativo, não hipotético):**
1. Controle de acesso à URL pública (2.4) — **maior risco de exposição de dados hoje**
2. Regra de formatação + proibição de travessão no `systemPrompt` (5.3, 5.4) — trivial, uma edição no mesmo arquivo
3. Botões de copiar código/nome isolados (5.2) — trivial, mesmo componente
4. Mensagem honesta de "capítulo ainda não coberto" (3.3) + analytics de buscas sem resultado (1.4) — para orientar a ordem de expansão de capítulos com dado real de uso, não achismo
5. Feedback thumbs up/down (3.1) — captura qualidade percebida do piloto em andamento

**Próximo horizonte:**
6. Suite de testes automatizados + CI/CD (2.1, 2.3) — reclassificado para Alto dado uso real em produção
7. Busca semântica/híbrida (1.2 / 5.1)
8. Expansão de cobertura para todos os capítulos restantes da CBHPM (1.1) — meta confirmada de escopo total; sequenciar por capítulo, reaproveitando o padrão dos parsers existentes

**Investimento estrutural:**
9. Importador administrável para novas edições (1.3)
10. Rate limiting (2.2) — importa mais assim que 2.4 reduzir a exposição pública direta

---

## 6. Triagem do brainstorm de zero custo (2026-08-13)

**Entrada:** `docs/brainstorm-zero-custo-2026-08-13.md` (@analyst / Atlas), 17 itens ZC-01 a ZC-17, baseline `cb83ee2`. Aquele documento é o registro do analyst e não é editado aqui; esta seção é a decisão de escopo e prioridade, que é o que o @sm usa para draftar a story.

**Validação feita antes de aprovar:** reli `src/app/api/search/route.js`, `src/app/page.jsx:96-212`, `src/app/api/versions/route.js`, `supabase/schema.sql:122-222` e `scripts/cbhpm-import/config/editions.mjs`. Todas as evidências de código dos itens aprovados conferem. Três achados adicionais meus, que mudam o desenho da story, estão em 6.2.

**Veredicto geral:** a inversão de prioridade proposta pelo analyst está correta e é aceita. Os quatro primeiros itens não são funcionalidades novas, são defeitos de fidelidade do dado num produto cuja proposta de valor é "100% determinístico". Corrigir dado exibido errado precede qualquer capacidade nova. Nenhum item do brainstorm foi descartado; o que não entra na 1.6 está sequenciado em 6.3.

### 6.1 Aprovado para a Story 1.6 — "Fidelidade do dado exibido"

Tema único da story: **o faturista nunca deve ver um dado errado, incompleto ou omitido em silêncio.** Todos os itens abaixo compartilham `ProcedureCard` (`src/app/page.jsx`), `/api/search` e `/api/chat`, o que torna o lote coerente para teste e revisão numa story só.

| # | ZC | Escopo aprovado | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|---|
| 6.1 | **ZC-02** | Distinguir `null` (não consta na fonte) de zero real em `valor_porte`, `valor_uco` e `uco`, reaproveitando a convenção "Não consta na fonte" que o card já usa para auxiliares. Absorve o micro-item ZC-17(b) (`uco \|\| '-'`), que é o mesmo defeito. | `src/app/page.jsx:112,117,118,119` contra `src/app/api/chat/route.js:71,75`. 2.327 registros do Cap. 4 com `custo_operacional` nulo. | **Alto** — único item com consequência financeira direta: "R$ 0,00" é lido como "não paga", não como "não sei". Card e texto da LLM se contradizem lado a lado hoje. | Muito baixo | **Alta** |
| 6.2 | **ZC-01** | Expor `custo_filme_doc`, `numero_incidencias`, `unidade_radiofarmaco` e `custo_operacional` no `SELECT_COLUMNS`, no `procedureContext` do chat e no card. Inclui **padronizar as colunas entre os 4 caminhos de busca** (ver 6.2 abaixo). | `src/app/api/search/route.js:103`, `src/app/page.jsx:96-212`, `src/app/api/chat/route.js:67-78`, `supabase/schema.sql:196-199`. FR-02 do PRD (`docs/prd.md:73`) dado como coberto sem estar. 2.706 registros afetados. | **Alto** — Radiologia e Medicina Nuclear são exatamente onde filme e incidências determinam a cobrança. Dado já pago nas Stories 1.3/1.4 que não chega ao usuário. | Muito baixo | **Alta** |
| 6.3 | **ZC-04** | Parar de descartar resultados em silêncio: renderizar os 10 que já trafegam, com indicação explícita de quantos há. | `src/app/page.jsx:491` (`slice(0, 5)`) contra `route.js:114,121,133,155` (todos `limit 10`). Seletor inicia em `'ALL'` (`page.jsx:271`). | **Médio-Alto** — o usuário conclui "não tem essa edição" quando ela veio na resposta e foi cortada. Não vira reclamação, vira desconfiança. | Muito baixo | **Alta** |
| 6.4 | **ZC-03 (parcial)** | **Entra:** identificar qual camada da cascata respondeu, rotular na UI o resultado vindo do fallback semântico como aproximado, e registrar esses casos em `search_events`. **Não entra:** o limiar numérico de distância vetorial (ver 6.2). | `supabase/schema.sql:165-179` (RPC sem `where` de similaridade), `src/app/api/search/route.js:150-166,177-179`. Caso real registrado em `docs/stories/1.5.ux-e-busca-acento.story.md:42`. | **Alto** — erro silencioso e confiante é o modo de falha mais perigoso do produto, e o que a arquitetura de grounding rígido existe para evitar. O rótulo elimina o dano mesmo sem o limiar. | Baixo | **Alta** |
| 6.5 | **ZC-16** | Gravar também as buscas com resultado, passando `teve_resultado` de verdade e o tipo de match. Entra por carona: a story já reescreve `logEmptySearch` por causa de 6.4. | `src/app/api/search/route.js:177-179`, `supabase/schema.sql:127-134` (coluna `teve_resultado` nunca recebe `true`). | **Médio** (habilitador) — sem isso, ZC-15 nasce limitado a um terço e o limiar de 6.4 nunca ganha base de calibração. | Muito baixo | **Média-Alta** |
| 6.6 | **ZC-17(a)** | Ordenar as edições cronologicamente em `/api/versions`, usando o campo `vigencia` que já existe por edição, em vez de `.sort()` alfabético. | `src/app/api/versions/route.js:25` contra `scripts/cbhpm-import/config/editions.mjs` (`vigencia: '2003'` para a 3ª edição). Confirmado: `.sort()` põe "CBHPM 3ª edição", a **mais antiga**, depois de "CBHPM 2018". | **Médio** — mesma classe de falha dos itens acima: o usuário age sobre dado apresentado errado e seleciona a edição errada, o que produz cobrança errada. | Muito baixo | **Média** |

**Por que estes seis e não mais.** A regra que apliquei foi coerência de tema, não proximidade de arquivo. Os seis compartilham a mesma pergunta de aceite: *o que a tela mostra corresponde ao que a fonte diz?* ZC-17(a) entra apesar de estar em outro arquivo porque é exatamente esse defeito. ZC-16 entra porque o código que ele altera já vai ser reescrito por 6.4, então o custo marginal é próximo de zero e sem ele o próximo passo nasce cego.

**O que foi deliberadamente mantido fora, apesar de barato:**

- **ZC-12 (teclado e foco)** — o analyst o coloca em quinto lugar nos quick wins e concordo com o valor, mas o critério de aceite é comportamento de interação, não fidelidade de dado. Misturar as duas coisas embaça a revisão e o gate de qualidade. Vai para a 1.7 como story própria de fluxo, junto com ZC-08.
- **ZC-13 (modo escuro) de carona** — o analyst sugere aproveitar que a 1.6 já toca as cores do `ProcedureCard`. Recusado. Migrar cerca de 80 ocorrências de cor literal num componente sem teste de UI, dentro de uma story cuja promessa é corrigir precisão de dado, transforma um lote de correções verificáveis num diff de regressão visual. O ganho de custo marginal não paga o ruído no gate.
- **Restante do ZC-17 (c a g)** — higiene sem consequência para o usuário. Fica agrupado como está.

### 6.2 Restrições técnicas que o @sm deve carregar para a story

Achados meus na validação, que mudam o desenho e precisam virar critério de aceite ou nota técnica:

1. **A RPC semântica não consegue devolver score sem trocar de assinatura.** `match_cbhpm_procedures` é `returns setof public.cbhpm_procedures` (`supabase/schema.sql:170`); devolver a distância exige `returns table(...)`, e Postgres não permite `create or replace` com mudança de tipo de retorno (precisa de `drop function` antes, com a rota quebrando entre uma coisa e outra). **Consequência de escopo:** o rótulo de "resultado aproximado" da 6.4 deve ser derivado de *qual ramo da cascata respondeu* — informação que a rota já tem, de graça, em `route.js:150-166` — e não do score. Isso mantém a 1.6 sem nenhuma migration.
2. **Por isso o limiar numérico não entra na 1.6.** Fixar um corte de distância sem a distribuição real de consultas é chute, e um limiar errado passa a esconder resultado correto, que é uma regressão pior do que o defeito atual. A ordem certa é: 1.6 instrumenta e rotula, a produção gera dado, e só então se calibra. Registrado em 6.5 como verificação pendente.
3. **`limit(10)` também é do banco, não só da UI.** Em "Todas as versões" com código parcial, sete edições podem estourar dez linhas antes de o resultado procurado aparecer. Renderizar os dez resolve o corte da UI mas não a raiz. A raiz é ZC-07 (agrupar por código e listar edições), que está no próximo horizonte. A story 1.6 deve reconhecer o limite explicitamente na mensagem ao usuário, não fingir que a lista é exaustiva.
4. **Log em toda busca não pode custar latência no caminho de sucesso.** Hoje o insert só ocorre no ramo vazio, que é raro. Passando a ocorrer sempre, um `await` entra na rota mais quente do produto, contra o objetivo de tempo de resposta do PRD. Critério: o registro é best-effort e não bloqueia a resposta.
5. **`search_events` pode não existir ainda** — a migration da seção 11 de `supabase/schema.sql` segue como ação pendente do usuário (linhas 121-122 deste documento) e não foi verificada. O padrão best-effort com `try/catch` já existente em `logEmptySearch` (`route.js:50-61`) deve ser preservado: **a story 1.6 não pode ser bloqueada pela migration**, apenas ter parte do seu valor adiada.
6. **Paridade de colunas entre os quatro caminhos de busca.** Código e full-text usam o `SELECT_COLUMNS` reduzido; as RPCs de unaccent e semântica devolvem `setof`, ou seja, todas as colunas. O mesmo procedimento chega ao frontend com conjuntos de campos diferentes conforme quem respondeu. Hoje é invisível porque a UI ignora o excedente; assim que a 6.2 renderizar os campos novos, vira inconsistência visível. Padronizar faz parte do escopo.
7. **Article IV vale para `unidade_radiofarmaco`.** O campo quase sempre é `*`, remetendo a uma tabela de preços externa do Colégio Brasileiro de Radiologia (`supabase/schema.sql:191-195`). Deve ser renderizado literalmente, com a origem explicada, e nunca interpretado como valor ou convertido em reais.

### 6.3 Aprovados para o próximo horizonte (não entram na 1.6)

| # | ZC | Item | Prioridade | Pré-requisito ou condição |
|---|---|---|---|---|
| 6.7 | ZC-12 | Foco automático após resposta, Escape, atalho global de busca, teclado no seletor de versões | **Alta** | Nenhum. Candidato natural à Story 1.7, junto com 6.8 |
| 6.8 | ZC-08 | Quando o filtro de edição zerou o resultado, dizer em qual edição o código existe | **Alta** | Nenhum |
| 6.9 | ZC-05 + ZC-06 | Consulta em lote com exportação CSV, em endpoint próprio de uma query só, sem chamar a LLM | **Alta** | **Validar com o usuário-piloto antes de dimensionar:** quantos códigos por guia, com que frequência, e se o destino do CSV é planilha ou importação em sistema. É o item que mais muda a ordem de grandeza do ganho e o que mais depende de observação do trabalho real |
| 6.10 | ZC-07 | Comparar o mesmo código entre as 7 edições numa visão só | **Alta** | Nenhum. Resolve a raiz que 6.3 apenas mitiga |
| 6.11 | ZC-03 (limiar) | Corte de distância vetorial na RPC semântica | **Alta** | **Bloqueado** por dado de calibração (ver 6.5, item 3). Exige `drop`/`create` da RPC |
| 6.12 | ZC-15 | Relatório de buscas sem resultado, **como script interno `npm run`, não como tela** | **Média** | Depois de 6.4 e 6.5, senão mede um retrato enviesado. Tela pública exporia padrões internos de trabalho numa URL sem autenticação |
| 6.13 | ZC-09 | Deep link por código e edição | **Média-Alta** | Nenhum. Pré-requisito barato de 6.14 |
| 6.14 | ZC-11 | Subtotal explicitamente rotulado e simulador de auxiliares | **Média** | **Gate de qualidade:** se for implementado como "valor total a faturar", deve ser barrado. Porte anestésico não tem valor em reais no banco (`supabase/schema.sql:50` guarda só o código) e auxiliares não somam ao honorário do cirurgião. Rotulagem é requisito, não detalhe |
| 6.15 | ZC-14 | PWA somente manifest, **sem service worker e sem cache offline** | **Média-Baixa** | Produção dos ícones é design, não código. Corte de escopo aceito: valor cacheado num app de precificação é erro financeiro silencioso |
| 6.16 | ZC-13 | Modo escuro | **Média-Baixa** | Pior valor por esforço da lista, apesar de prometido no NFR de Usability. Só faz sentido dentro de uma refatoração declarada da `page.jsx` (531 linhas, componentes e utilitários no mesmo módulo), nunca de carona numa story de correção |
| 6.17 | ZC-17 (c a g) | Lote de higiene restante: `valor_versao` não exibido no card mas citado pela LLM, `capitulo` buscado e nunca usado, `QUICK_SUGGESTIONS` fixo, `/api/versions` sem rate limit, `index.html` e `dist/` resquícios da app Vite | **Baixa** | Nenhum. O item (a) foi promovido para a 1.6; o resto segue agrupado. Nota ao @dev: (f) é carona trivial se a 1.6 já estiver editando `/api/versions`, mas **não é critério de aceite da 1.6** |

**Fora de escopo, registrado para não ser redescoberto:** rate limit distribuído (Redis/Upstash) exige serviço externo novo e fere o critério de custo zero; a limitação atual do limitador em memória por instância (`src/lib/rate-limit.js:1-6`) segue conhecida e aceita. Reintroduzir autenticação continua fora de pauta por decisão de stakeholder (linhas 41 e 109 deste documento).

### 6.4 Fusão de item duplicado

O analyst sinalizou sobreposição entre **ZC-10** (histórico de consultas e favoritos em localStorage) e o item **3.2** deste documento (histórico de conversa não persiste). **Decisão: fundir em 3.2**, que passa a ler "persistência no cliente: conversa, consultas recentes e favoritos, em localStorage", mantendo prioridade **Baixa**. São necessidades distintas mas o mesmo mecanismo, o mesmo arquivo e o mesmo teste; manter duas entradas produziria duas stories que se atropelam. Não abro entrada nova no backlog para ZC-10.

### 6.5 Verificações pendentes (dependem de acesso ao banco de produção)

Nem eu nem o @analyst temos acesso ao banco de produção. Estas três verificações ficam registradas como **ação pendente do usuário**, não como bloqueio da Story 1.6:

1. **Extensão real do sintoma de 6.1 fora do Capítulo 4.** `select capitulo, count(*) from cbhpm_procedures where valor_porte is null group by 1;` — hoje o volume de 2.327 registros é medido só sobre o Cap. 4, a partir dos relatórios de parsing. Se o padrão se repetir nos Capítulos 1 a 3, o impacto de 6.1 é maior do que o registrado, não menor. Não muda a decisão de aprovar, muda a comunicação do ganho.
2. **Se as migrations das seções 10, 11 e 14 de `supabase/schema.sql` já foram aplicadas.** Registradas como pendentes desde a Story 1.2 (linhas 121-122) e reafirmadas em `docs/stories/1.5.ux-e-busca-acento.story.md:46`. **Consequência direta:** se a seção 11 não estiver aplicada, `search_events` está vazia, e 6.5 grava no vácuo enquanto 6.12 não tem sobre o que operar. Vale confirmar antes de a 1.7 ser planejada.
3. **Distribuição de distância vetorial de consultas reais contra `match_cbhpm_procedures`,** para calibrar o limiar de 6.11 com dado em vez de chute. É justamente o que a instrumentação de 6.4 e 6.5 passa a produzir em produção, então esta verificação deixa de exigir acesso manual ao banco assim que a 1.6 estiver no ar por alguns dias.

### 6.6 Risco da decisão

O risco de aprovar este lote não é técnico, é de percepção: são seis correções sem nenhuma funcionalidade visivelmente nova, num piloto que já está em produção e cujo stakeholder vem recebendo entregas de capacidade a cada story. O contra-argumento, que sustento: quatro dos seis corrigem casos em que a ferramenta **mostra hoje um dado que não corresponde à fonte**, num produto de faturamento. Uma capacidade nova construída sobre uma ficha que exibe "R$ 0,00" onde a CBHPM não traz valor amplia o alcance do erro em vez de amplia o do valor. O ganho comunicável ao usuário existe e é concreto: o Capítulo 4 passa a mostrar filme, incidências e radiofármaco, e a lista deixa de esconder metade dos resultados.

Risco de execução a monitorar: seis itens pequenos numa story só diluem o critério de aceite se cada um não tiver AC próprio e verificável. Recomendo ao @sm um AC por item, com o de 6.4 escrito em termos de comportamento observável ("resultado vindo do fallback semântico aparece rotulado como aproximado"), nunca em termos de limiar numérico.

---

## Sequenciamento recomendado (revisado 2026-08-13)

**Story 1.6 — Fidelidade do dado exibido (aprovada, pronta para draft do @sm):**
6.1 (ZC-02) · 6.2 (ZC-01) · 6.3 (ZC-04) · 6.4 (ZC-03 parcial) · 6.5 (ZC-16) · 6.6 (ZC-17a)

**Story 1.7 — Fluxo e teclado (candidata, sem dependências):**
6.7 (ZC-12) · 6.8 (ZC-08)

**Próximo horizonte, por ordem de valor:**
6.9 (ZC-05 + ZC-06, exige validação prévia com o piloto) · 6.10 (ZC-07) · 6.12 (ZC-15, depois de 6.4 e 6.5) · 6.13 (ZC-09) · 6.14 (ZC-11, com gate de rotulagem)

**Bloqueado por dado:**
6.11 (ZC-03 limiar) — liberar quando a instrumentação da 1.6 tiver rodado em produção

**De carona em algo maior:**
3.2 fundido com ZC-10 · 6.17 (ZC-17 c a g) · 6.15 (ZC-14) · 6.16 (ZC-13)

---

**Generated by:** Synkra AIOX - @pm (Morgan)
