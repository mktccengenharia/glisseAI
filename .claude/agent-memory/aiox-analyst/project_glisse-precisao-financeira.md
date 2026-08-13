---
name: glisse-precisao-financeira
description: Glisse AI — por que "não consta na fonte" nunca pode virar 0/R$ 0,00, e por que somar campos da CBHPM num "valor total" é inventar dado
metadata:
  type: project
---

No Glisse AI, a distinção entre **dado ausente na fonte** (`null`) e **zero real** é regra de negócio, não detalhe de UI. A CBHPM traz linhas sem custo operacional, sem porte precificado ou sem número de auxiliares; exibir isso como `0` ou `R$ 0,00` é lido pelo faturista como "não paga".

Dois campos não permitem cálculo de "valor total do procedimento" com os dados atuais:
- `porte_anestesico` é `smallint` e guarda **o código do porte**, não reais. A tabela de preços do ato anestésico não foi importada.
- Auxiliares de cirurgia são pagos a outros profissionais e não somam ao honorário do cirurgião.

**Why:** a promessa central do produto é precisão 100% determinística (PRD, NFR de Accuracy) e o Article IV (No Invention) da Constitution. Um total plausível e errado é pior que nenhum total, porque vira cobrança.

**How to apply:** ao avaliar qualquer feature de cálculo, agregação ou exibição de valor, verificar se cada parcela existe de fato no banco. Se não existir, propor subtotal explicitamente rotulado com os componentes visíveis, nunca um "total a faturar". Ver [[glisse-constraints]].
</content>
