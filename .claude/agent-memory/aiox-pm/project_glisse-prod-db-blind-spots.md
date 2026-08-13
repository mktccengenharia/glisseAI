---
name: glisse-prod-db-blind-spots
description: Glisse AI — no agent has production Supabase access; migrations applied manually by the user, so "implemented" does not mean "active"
metadata:
  type: project
---

Nenhum agente tem acesso ao Supabase de produção do Glisse AI. As migrations de `supabase/schema.sql` são aplicadas **manualmente pelo usuário** no SQL Editor, seção por seção. As seções 10 (`chat_feedback`), 11 (`search_events`) e 14 (RPC unaccent) estão registradas como pendentes desde a Story 1.2 e nunca foram confirmadas como aplicadas.

**Why:** isso quebra a equivalência entre "código feito" e "funcionalidade ativa". Vários itens do backlog (analytics de busca, relatório de termos sem resultado, calibração do limiar semântico) dependem de tabelas que podem estar vazias ou inexistentes em produção.

**How to apply:** ao priorizar ou estimar qualquer item que leia/escreva `search_events` ou `chat_feedback`, tratar a migration como pré-requisito não verificado e nunca como bloqueio da story — o código do projeto usa padrão best-effort com `try/catch` justamente por isso. Perguntas que exigem consultar o banco (contagens, distribuições) viram ação pendente do usuário, não inferência. Ver [[glisse-roadmap]].
