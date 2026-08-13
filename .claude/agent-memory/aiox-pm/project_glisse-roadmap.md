---
name: glisse-roadmap
description: Glisse AI (RAG CBHPM) roadmap state — Story 1.6 approved as a data-fidelity fix lot; how backlog docs are split between @pm and @analyst
metadata:
  type: project
---

`docs/opportunity-mapping.md` é o backlog priorizado do produto e pertence ao @pm. Brainstorms do @analyst (ex. `docs/brainstorm-zero-custo-2026-08-13.md`) são entradas de triagem e nunca são editados pelo @pm — a decisão vira uma seção datada nova no opportunity-mapping, sem reescrever o histórico.

Em 2026-08-13 aprovei a **Story 1.6 "Fidelidade do dado exibido"** com seis itens (ZC-02, ZC-01, ZC-04, ZC-03 parcial, ZC-16, ZC-17a), todos correções de dado exibido errado, não funcionalidades novas.

**Why:** o produto se vende como "100% determinístico" para faturamento hospitalar e está em piloto de produção. Quatro dos itens são casos em que a tela mostra dado que não corresponde à fonte CBHPM (ex. "R$ 0,00" onde a fonte não traz valor). Construir capacidade nova sobre isso amplia o alcance do erro.

**How to apply:** ao priorizar no Glisse, correção de fidelidade de dado precede capacidade nova. Story = tema único e verificável, não proximidade de arquivo — recusei empacotar dark mode (ZC-13) só porque tocava o mesmo componente. Ver também [[glisse-prod-db-blind-spots]].
