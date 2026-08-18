---
name: glisse-precisao-financeira
description: Glisse AI — por que "não consta na fonte" nunca pode virar 0/R$ 0,00, e por que somar campos da CBHPM num "valor total" é inventar dado
metadata:
  type: project
---

No Glisse AI, a distinção entre **dado ausente na fonte** (`null`) e **zero real** é regra de negócio, não detalhe de UI. A CBHPM traz linhas sem custo operacional, sem porte precificado ou sem número de auxiliares; exibir isso como `0` ou `R$ 0,00` é lido pelo faturista como "não paga".

Dois campos não somam ao honorário do cirurgião e por isso não existe "valor total do procedimento":
- `porte_anestesico` remunera **o anestesista**, não o cirurgião.
- Auxiliares de cirurgia são pagos a **outros profissionais**.

**Correção (2026-08-17):** antes eu registrei aqui que o valor do ato anestésico seria incalculável por falta de tabela de preços. Isso estava errado. A CBHPM publica no próprio texto (Instruções Gerais Específicas para a Anestesiologia, item 2) a correspondência porte anestésico -> porte CBHPM: 0 = anestesia local (não participação), 1=3A, 2=3C, 3=4C, 4=6B, 5=7C, 6=9B, 7=10C, 8=12A. Verificada **idêntica em 8 edições** (3ª, 2008, 2010, 2014, 2015, 2016, 2018, 2022). Logo `porte_anestesico` + `cbhpm_porte_valores` já bastam. Blog da Rivio publica correspondência divergente e deve ser rejeitado. Detalhes em `docs/research/2026-08-17-fundamentos-faturamento-cbhpm/`.

Base de cálculo do auxiliar é **só o porte** ("percentual de X% da valoração do porte do ato praticado pelo cirurgião", item 5.1), nunca porte + custo operacional.

**Why:** a promessa central do produto é precisão 100% determinística (PRD, NFR de Accuracy) e o Article IV (No Invention) da Constitution. Um total plausível e errado é pior que nenhum total, porque vira cobrança.

**How to apply:** ao avaliar qualquer feature de cálculo, agregação ou exibição de valor, verificar se cada parcela existe de fato no banco. Se não existir, propor subtotal explicitamente rotulado com os componentes visíveis, nunca um "total a faturar". Ver [[glisse-constraints]].
</content>
