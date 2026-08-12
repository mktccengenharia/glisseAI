# Mapeamento de Oportunidades de Melhoria — Glisse AI (RAG CBHPM)

**Version:** 1.0.0
**Status:** Draft
**Owner:** @pm (Morgan)
**Date:** 2026-08-12
**Baseline:** Estado atual do `main` (commit `13dcf7c`) vs. `docs/prd.md` v1.0.0

---

## Método

Este mapeamento cruza três fontes: (1) o que o PRD v1.0.0 prometeu, (2) o que está de fato implementado no código hoje, e (3) lacunas de produto que o PRD não cobria. Cada item traz evidência (arquivo/linha), impacto no negócio, esforço estimado e prioridade (RICE simplificado: Alto/Médio/Baixo).

---

## 1. Gaps críticos vs. PRD v1.0.0

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| 1.1 | **Cobertura de dados incompleta** — apenas Capítulos 1, 2 e 3 da CBHPM foram parseados e importados. A tabela CBHPM tem mais capítulos (procedimentos clínicos, exames complementares etc.) que hoje não existem no banco. | `scripts/cbhpm-import/lib/` só tem `parse-cap1/2/3.mjs`; `parse-cap3.mjs` trata "CAPÍTULO 4" apenas como delimitador de fim, não como conteúdo a extrair. | **Alto** — usuário busca um procedimento fora do Cap. 1-3 e o sistema simplesmente não encontra, sem sinalizar "capítulo ainda não importado" (parece bug, não limitação conhecida). Mina a confiança do setor de cobrança logo na adoção. | Médio (replicar padrão dos parsers existentes por capítulo) | **Alto** |
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

**Ação pendente do usuário para ativar 100% do que foi implementado:**
1. Rodar as seções 10 e 11 de `supabase/schema.sql` no SQL Editor do Supabase (tabelas `chat_feedback` e `search_events`) — busca semântica (seção 12) já está aplicada e ativa desde 2026-08-12

Bloqueado por insumo externo (não é falta de esforço de código):

| Item | Bloqueio | O que resolve |
|---|---|---|
| 1.1 Expansão para todos os capítulos da CBHPM | Não há PDFs-fonte dos Capítulos 4+ no repositório | Usuário fornecer os PDFs oficiais dos capítulos restantes |
| 1.3 Importador administrável | Fora do sprint imediato por decisão de sequenciamento (só compensa com mais tração) | Decisão de priorização, não é bloqueio técnico |

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

**Generated by:** Synkra AIOX - @pm (Morgan)
