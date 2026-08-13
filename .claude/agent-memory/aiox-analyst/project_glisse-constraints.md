---
name: glisse-constraints
description: Glisse AI (CBHPM) — restrições fixas de produto: sem autenticação (decisão do stakeholder), zero custo de infra novo, e quem é dono de cada doc de backlog
metadata:
  type: project
---

O Glisse AI opera sob três restrições que se repetem entre sessões:

1. **Autenticação foi removida deliberadamente** e a URL fica aberta. Não sugerir reintroduzir.
2. **Zero custo de infraestrutura novo** é o critério de corte para novas ideias: só Supabase/tabelas já existentes, lógica client-side, ou queries adicionais sobre dados já povoados. Nada de Redis/Upstash, API paga nova ou provedor de analytics de terceiros.
3. **Ownership de documentos:** `docs/opportunity-mapping.md` é do @pm (não editar). O @analyst entrega backlog novo em arquivo próprio, para o @pm triar depois. `docs/prd.md` é a fonte formal de personas e NFRs.

**Why:** (1) e (2) foram decisões explícitas do stakeholder, com o risco de exposição de dados de precificação aceito conscientemente e registrado em `docs/opportunity-mapping.md`. (3) evita conflito de edição entre agentes no mesmo backlog.

**How to apply:** ao propor melhorias, ancorar cada item em evidência de código/PRD e declarar o custo de infra. Se uma ideia boa esbarrar na falta de autenticação (ex.: painel interno numa URL pública), absorver a restrição no desenho (script interno em vez de tela) em vez de reabrir a discussão. Ver [[glisse-precisao-financeira]].
</content>
