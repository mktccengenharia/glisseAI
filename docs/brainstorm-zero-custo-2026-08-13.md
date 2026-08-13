# Brainstorm de Oportunidades com Zero Custo de Infraestrutura — Glisse AI (CBHPM)

**Version:** 1.0.0
**Status:** Draft (para triagem do @pm)
**Owner:** @analyst (Atlas)
**Date:** 2026-08-13
**Baseline:** `main` no commit `cb83ee2` (Story 1.5 concluída), cruzado com `docs/prd.md` v1.0.0 e `docs/opportunity-mapping.md` v1.0.0

> Este documento NÃO substitui nem edita `docs/opportunity-mapping.md`, que segue sendo propriedade do @pm. Ele é uma entrada de backlog para triagem: itens novos, validados contra o código, que ainda não estão rastreados lá.

---

## Método e critério de corte

**Critério inegociável desta rodada: zero custo de infraestrutura novo.** Um item só entra aqui se puder ser construído com:

1. lógica no cliente (localStorage, geração de CSV no browser, manifest PWA, atalhos de teclado), ou
2. queries adicionais sobre tabelas Supabase que já existem e já estão povoadas, ou
3. mudança em código de rota/UI já existente.

Fica de fora qualquer coisa que exija API paga nova, serviço externo novo, store distribuído (Redis/Upstash), provedor de analytics de terceiros ou aumento de plano.

**Como cada item foi validado:** leitura direta do código (`src/app/page.jsx`, `src/app/api/*`, `supabase/schema.sql`, `scripts/cbhpm-import/`), dos relatórios de parsing já gerados (`scripts/cbhpm-import/output/*-cap4-report.json`) e do PRD. Cada linha da coluna Evidência aponta arquivo e linha. Onde a evidência é indireta, está declarado no fim do documento, na seção de confiança.

**Escala:** Impacto e Esforço em Alto / Médio / Baixo, Prioridade em Alta / Média / Baixa, mesma convenção RICE simplificada de `opportunity-mapping.md`.

**Achado que reorganizou a lista:** os quatro itens de maior valor por esforço não estavam entre os nove candidatos originais. São defeitos de fidelidade do dado: informação que já foi extraída, validada e gravada no banco (custo pago nas Stories 1.3 e 1.4) mas que nunca chega ao faturista, ou que chega distorcida. Num produto cuja promessa central é "100% determinístico" (PRD, NFR de Accuracy), isso vale mais do que qualquer funcionalidade nova.

---

## 1. Fidelidade do dado: o que já está no banco e não chega ao usuário

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-01 | **Campos do Capítulo 4 nunca chegam à interface.** As colunas `custo_filme_doc`, `numero_incidencias` e `unidade_radiofarmaco` foram criadas, parseadas e importadas na Story 1.4, mas não estão na lista de colunas que `/api/search` devolve, não entram no contexto enviado à LLM e não são renderizadas no card. `custo_operacional` está no SELECT, mas também não é renderizado nem enviado ao chat. | `src/app/api/search/route.js:103` (`SELECT_COLUMNS` sem os três campos), `src/app/page.jsx:96-212` (`ProcedureCard` sem esses campos), `src/app/api/chat/route.js:67-78` (`procedureContext` sem esses campos), `supabase/schema.sql:196-199` (colunas existem). O PRD pede explicitamente "Filme/Custo Operacional" em **FR-02** (`docs/prd.md:73`). Volume medido nos relatórios de parsing: **2.706 registros** com esses campos preenchidos (635 com `unidade_radiofarmaco`, 2.071 com `numero_incidencias`) somando as 7 edições, aproximadamente 20% do Capítulo 4. | **Alto** — Radiologia e Medicina Nuclear são exatamente onde custo de filme e número de incidências determinam a cobrança. Hoje o faturista vê uma ficha incompleta e precisa voltar ao PDF justamente no capítulo mais recém-conquistado. É um requisito P1 do PRD marcado como coberto que na prática não está. | **Muito baixo** — acrescentar 3 nomes ao `SELECT_COLUMNS`, 3 blocos condicionais no card e 3 linhas no `procedureContext`. Sem migration, sem reimportação. | **Alta** |

> **Custo de infraestrutura: zero.** Dados já povoados no Supabase; a query já roda, só devolve menos colunas do que poderia. Nenhuma linha nova, nenhuma chamada externa nova.
>
> **Efeito colateral já existente que isso corrige:** os fallbacks de busca sem acento e semântica usam RPCs que retornam `setof public.cbhpm_procedures`, ou seja, **todas** as colunas (`supabase/schema.sql:208-221` e `:165-179`), enquanto a busca por código e a full-text usam o `SELECT_COLUMNS` reduzido. O mesmo procedimento chega ao frontend com conjuntos de campos diferentes dependendo de qual camada da cascata respondeu. Hoje isso é invisível porque a UI ignora os campos extras; assim que ZC-01 for implementado, vira inconsistência visível. Padronizar as duas rotas faz parte do item.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-02 | **A ficha mostra "R$ 0,00" onde a fonte não traz valor nenhum.** O formatador do card faz `(val \|\| 0).toLocaleString(...)`, então `null` (dado ausente na CBHPM) e zero real (dado presente e igual a zero) viram a mesma string. Na mesma resposta, o texto gerado pela LLM diz corretamente "não informado", porque a rota de chat trata o caso com `typeof p.valor_uco === 'number'`. Card e texto se contradizem lado a lado. | `src/app/page.jsx:112` (`fmt`), `:118-119` (`item.valorPorteR$ \|\| item.valor_porte \|\| 0`), `:117` (`item.uco \|\| '-'`, que esconde um UCO igual a zero) contra `src/app/api/chat/route.js:71,75`. Volume medido: **2.327 registros do Capítulo 4** (17% do capítulo, somando as 7 edições) têm `custo_operacional = null` na origem, o que produz `valor_uco = null` no import (`scripts/cbhpm-import/14-import-cap4.mjs:108-110`). O mesmo padrão vale para `valor_porte`, que recebe `null` quando o código de porte não tem preço na vigência (`:106`). | **Alto** — este é o único item da lista com consequência financeira direta. "R$ 0,00" numa ferramenta de faturamento é lido como "não paga", não como "não sei". Contradiz frontalmente o NFR de Accuracy do PRD (`docs/prd.md:87`) e a regra de "não consta é diferente de 0" que o próprio systemPrompt já defende (`api/chat/route.js:87`). | **Muito baixo** — trocar as coerções por checagem explícita de `null`/`undefined`, reaproveitando a convenção "Não consta na fonte" que o card já usa para auxiliares (`page.jsx:154-156`). | **Alta** |

> **Custo de infraestrutura: zero.** Mudança puramente de renderização no cliente.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-03 | **A busca semântica não tem limiar de similaridade e nunca admite que não encontrou.** A RPC ordena por distância vetorial e devolve `limit match_count` sem filtro de corte. Como ela é o último degrau da cascata, qualquer consulta que chegue até ali volta com 10 procedimentos, por mais distantes que sejam, apresentados na UI com a mesma aparência de um acerto exato. Dois efeitos: (a) o usuário recebe resultado plausível e errado sem nenhuma sinalização; (b) `logEmptySearch` só dispara quando `results.length === 0`, então essas falhas reais **nunca** entram em `search_events`, contaminando a única fonte de dado de qualidade de busca que existe. | `supabase/schema.sql:165-179` (`match_cbhpm_procedures`, sem `where` de similaridade), `src/app/api/search/route.js:150-166` (chamada sem limiar), `:177-179` (log condicionado a zero resultados). Comprovado em teste ao vivo registrado na própria Story 1.5: "sem a migration aplicada, a busca por 'disseccao' cai no fallback semântico e retorna um procedimento só parecido ('Discectomia'), não o esperado" (`docs/stories/1.5.ux-e-busca-acento.story.md:42`). | **Alto** — é o modo de falha mais perigoso do produto: erro silencioso e confiante, exatamente o que a arquitetura de grounding rígido foi desenhada para evitar. E cega o instrumento de medição de qualidade. | **Baixo** — adicionar um corte de distância na RPC (uma linha de `where`), devolver o tipo de match e o score em `/api/search`, rotular na UI ("resultado aproximado") e registrar em `search_events` quando só houver match aproximado. | **Alta** |

> **Custo de infraestrutura: zero.** Alteração numa função SQL já existente e nas tabelas já criadas. O limiar precisa ser calibrado empiricamente com consultas reais antes de fixar o valor; o `search_events` corrigido serve exatamente para isso.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-04 | **A busca traz 10 resultados e a interface descarta 5 em silêncio.** Todas as rotas de busca usam `limit(10)`, mas o render corta em `slice(0, 5)` sem qualquer indicação de que havia mais. O caso pior é o padrão de uso mais comum: com a versão em "Todas as versões", buscar um código exato traz o mesmo procedimento repetido nas 7 edições, e os 5 slots se esgotam antes de aparecer a edição que o faturista precisa. | `src/app/page.jsx:491` (`msg.cards.slice(0, 5)`) contra `src/app/api/search/route.js:114,121,133,155` (todos `limit 10`). O seletor inicia em `'ALL'` (`page.jsx:271`) e a restrição `unique (codigo, versao)` garante uma linha por edição (`supabase/schema.sql:57`). | **Médio-Alto** — o usuário conclui "não tem essa edição" quando na verdade ela veio na resposta e foi cortada. Silencioso, portanto não vira reclamação: vira desconfiança. | **Muito baixo** — expandir para 10 ou colocar um "ver mais N resultados". Combinado com ZC-07, agrupar por código e listar as edições resolve a raiz. | **Alta** |

> **Custo de infraestrutura: zero.** Os 10 registros já trafegam do banco até o browser; são descartados na renderização.

---

## 2. Fluxo real do faturista

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-05 | **Consulta em lote (colar vários códigos e receber uma tabela).** Cenário real de conferência de guia e de contestação de glosa, onde o operador confere dezenas de códigos de uma vez. Hoje só existe o fluxo de uma consulta por vez, com síntese da LLM a cada uma. | Não existe nenhum caminho de múltiplos códigos: `handleSend` trata `query` como string única (`src/app/page.jsx:302-355`) e `/api/search` aceita um único `q` (`route.js:87`). Cobre a lacuna entre o Goal 5 do PRD (reduzir 80% do tempo por consulta) e o trabalho por guia, não por item. | **Alto** — é o único item da lista que muda a ordem de grandeza do ganho: de "consulta mais rápida" para "conferência da guia inteira de uma vez". | **Médio** — precisa de rota nova. | **Alta** |

> **Custo de infraestrutura: zero.** Uma query só, com `.in('codigo', [...])` sobre a tabela existente, com um teto de códigos por requisição.
>
> **Restrição técnica que define o desenho:** não pode ser implementado como N chamadas ao `/api/search` atual. O rate limit é de 30 requisições por minuto por IP nessa rota (`src/app/api/search/route.js:64-68`), então colar 50 códigos derrubaria o próprio usuário legítimo com HTTP 429. Tem que ser um endpoint de lote com uma única query. Recomendação adicional: nesse fluxo, **não** chamar a LLM (o valor está na tabela determinística, e evitar a síntese elimina latência, o limite de 15 por minuto do `/api/chat` e qualquer risco de reinterpretação de valores).

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-06 | **Exportar resultados em CSV.** Levar o resultado para planilha, para o sistema de faturamento ou para anexar numa contestação de glosa. | Hoje o único caminho de saída de dados são os três botões de copiar do card (`src/app/page.jsx:177-206`), que operam sobre um procedimento por vez e sobre três campos. O PRD já reconhece a saída de dados como necessidade em **FR-06** (`docs/prd.md:77`), atendida só parcialmente. | **Médio-Alto** — sozinho é uma conveniência; acoplado a ZC-05 é o que fecha o ciclo de conferência de guia. | **Muito baixo** — montar a string CSV e disparar download via `Blob` + `URL.createObjectURL`, sem biblioteca. | **Alta** (junto com ZC-05) |

> **Custo de infraestrutura: zero.** Cem por cento no cliente, nenhum byte a mais no servidor. Atenção a dois detalhes de compatibilidade com Excel em português: separador `;` e BOM UTF-8, senão acentos e valores quebram na abertura.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-07 | **Comparar o mesmo código entre as 7 edições numa visão só.** Cada operadora negocia por edição diferente; saber quanto o mesmo procedimento vale na 2016 contra a 2018 é decisão de cobrança, não curiosidade. Hoje é preciso trocar o seletor de versão e repetir a busca, uma edição por vez. | O banco já tem exatamente essa estrutura: `unique (codigo, versao)` (`supabase/schema.sql:57`) e `valor_versao` gravado por linha (`scripts/cbhpm-import/14-import-cap4.mjs:118`). O seletor de versão filtra uma por vez (`src/app/page.jsx:314`, `?version=`). É o Goal 4 do PRD, "Suporte Multi-Tabela / Versões CBHPM" (`docs/prd.md:36`), entregue só como filtro, nunca como comparação. Não estava entre os 9 candidatos originais. | **Alto** — transforma um dado que já custou 7 importações completas numa capacidade que o usuário não tem hoje por nenhum outro meio. | **Baixo** — uma query `.eq('codigo', X)` sem filtro de versão e uma tabela de renderização. | **Alta** |

> **Custo de infraestrutura: zero.** Query adicional sobre dados já povoados, sem coluna nova e sem migration.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-08 | **Quando a busca vazia foi causada pelo filtro de edição, dizer em qual edição o código existe.** A mensagem de "nenhum resultado" hoje levanta a hipótese ("ou que não está presente na edição selecionada") mas não verifica, deixando o trabalho de descobrir para o usuário. | `src/app/page.jsx:318-326` (mensagem estática) e `src/app/api/search/route.js:107` (o filtro `.eq('versao', version)` é a causa provável). O `search_events` já grava a versão da busca falha (`route.js:52-56`), sinal de que a hipótese já era considerada relevante. | **Médio-Alto** — converte um beco sem saída em resposta útil, no ponto exato do fluxo em que o usuário está prestes a desistir e abrir o PDF. | **Baixo** — quando o resultado vier vazio e `version !== 'ALL'`, repetir a query sem o filtro e devolver a lista de edições em que o código existe. | **Alta** |

> **Custo de infraestrutura: zero.** Uma segunda query condicional, só no caminho de erro, portanto raro por definição.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-09 | **Deep link para um procedimento e edição (URL compartilhável).** Mandar o código pronto para um colega, para a auditoria ou para a operadora, sem descrever o caminho de busca. | A aplicação tem uma rota só, `src/app/page.jsx`, que nunca lê parâmetros de URL; todo o estado inicial é `useState` (`:268-273`). Não há `useSearchParams` em lugar nenhum de `src/`. | **Médio** — valor real em contestação de glosa e em treinamento de equipe. Além disso é pré-requisito barato de ZC-10 e de qualquer atalho de "voltar a este resultado". | **Baixo** — ler `?codigo=` e `?versao=` no carregamento e disparar a busca. | **Média-Alta** |

> **Custo de infraestrutura: zero.** Roteamento do próprio Next, sem persistência nova.
>
> **Cuidado técnico:** no App Router do Next 14, `useSearchParams` num componente cliente exige `<Suspense>` no build estático, senão `npm run build` quebra. Alternativa mais barata: ler `window.location.search` dentro de um `useEffect`.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-10 | **Histórico de buscas recentes e favoritos em localStorage**, sem conta e sem autenticação. | Não há persistência de nada no cliente: `messages` vive em `useState` (`src/app/page.jsx:268`) e o botão "voltar" apaga tudo (`handleExitChat`, `:296-300`). As sugestões rápidas são uma constante fixa no código (`QUICK_SUGGESTIONS`, `:258-263`), que um histórico real substituiria com muito mais precisão. | **Médio** — a mesma equipe consulta o mesmo conjunto de códigos todo dia. Favoritos eliminam a redigitação; recentes eliminam o "qual era mesmo o código que eu acabei de ver". | **Baixo** — leitura e escrita em `localStorage`, com teto de itens. | **Média** |

> **Custo de infraestrutura: zero.** Armazenamento no navegador do usuário, nada trafega.
>
> **Sobreposição declarada:** o item 3.2 de `docs/opportunity-mapping.md` já registra "histórico de conversa não persiste", com prioridade Baixa e localStorage citado como solução. São coisas diferentes (lá é a **conversa**, aqui são **consultas e favoritos**), mas se sobrepõem na implementação. @pm deve decidir se funde os dois num item só. Sinalizado para não criar entrada duplicada no backlog.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-11 | **Subtotal transparente do procedimento e simulador de auxiliares** (versão reformulada do candidato original "cálculo automático do valor total"). Mostrar `valor_porte + valor_uco` como subtotal explicitamente rotulado, com a conta visível, e permitir simular quantos auxiliares serão cobrados dentro do máximo permitido pelo código. | `valor_uco` já é grandeza em reais, não quantidade: o import calcula `custo_operacional × valor_uco_da_edição` (`scripts/cbhpm-import/14-import-cap4.mjs:6,108-110`), portanto somar com `valor_porte` é aritmeticamente coerente. Os percentuais de rateio por edição já vêm por linha em `aux_pct` (`src/app/page.jsx:127`, `supabase/schema.sql:98-99`). O card já exibe os quatro componentes separados e nunca os relaciona (`page.jsx:133-169`). | **Médio** — economiza a calculadora ao lado do teclado, que é o gesto que o produto se propôs a eliminar. | **Baixo-Médio** — a aritmética é trivial; o cuidado está na rotulagem. | **Média** |

> **Custo de infraestrutura: zero.** Cálculo no cliente sobre campos já entregues pela API.
>
> **Por que reformulado e não aceito como estava:** o candidato original pedia somar porte, UCO, auxiliares e porte anestésico num "valor total do procedimento". Duas razões concretas impedem isso hoje. Primeira: o **porte anestésico não tem valor em reais no banco**. A coluna é `smallint` e guarda o código do porte (`supabase/schema.sql:50`), e a tabela de preços do ato anestésico não foi importada. Somá-lo exigiria inventar um valor, o que viola o Article IV (No Invention) e a promessa de 100% determinístico. Segunda: **auxiliares não somam ao honorário do cirurgião**; são pagos a outros profissionais e frequentemente lançados em linhas próprias da guia. Um "total" que os inclua produz um número que não corresponde a nenhuma cobrança real. Um subtotal explicitamente rotulado, com os componentes visíveis, entrega quase todo o valor sem nenhum desses riscos. **Se o item for implementado como "valor total a faturar", deve ser barrado no gate de qualidade.**

---

## 3. Requisitos de usabilidade prometidos no PRD

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-12 | **Navegação por teclado e atalhos.** O NFR de Usability do PRD pede "navegação por teclado" e nunca foi construído. Três lacunas concretas: (a) ao enviar a primeira consulta a tela troca de ramo de render e o input é remontado sem foco (`autoFocus` é `false` na tela de chat), obrigando a pegar o mouse para a segunda pergunta, no ponto de maior repetição do fluxo; (b) o dropdown de versões só fecha por clique fora, não responde a Escape nem a setas e não tem atributos ARIA; (c) não há atalho global para focar a busca. | `docs/prd.md:88` (NFR). `src/app/page.jsx:388-437` contra `:440-530` (dois ramos de retorno distintos, `renderInputBar(true)` na home e `renderInputBar(false)` no chat), `:53-92` (`VersionSelector`, listener só de `mousedown`), ausência de qualquer `e.key === 'Escape'` ou handler de atalho no arquivo. | **Médio-Alto** — o perfil é digitação de alto volume o dia inteiro. Cada ida ao mouse por consulta, multiplicada por dezenas de consultas ao dia, é exatamente o custo que o Goal 5 do PRD quer eliminar. É também o item de melhor razão valor/esforço do bloco 3. | **Baixo** — foco programático após resposta, Escape para limpar e fechar, `/` ou Ctrl+K para focar a busca, teclas de seta no seletor. | **Alta** |

> **Custo de infraestrutura: zero.** Event handlers no cliente.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-13 | **Modo escuro/claro.** Também citado no NFR de Usability do PRD e nunca construído. | `docs/prd.md:88`. O terreno está meio preparado: `darkMode: ["class"]` já configurado (`tailwind.config.js:3`) e os tokens semânticos existem (`src/app/globals.css:5-38`). Mas o `page.jsx` **não usa** esses tokens: são cerca de 80 ocorrências de cores literais (`bg-white`, `text-black`, `text-gray-400`, `border-gray-100`) espalhadas por todos os componentes, além de um `<style>` inline injetado na home (`:391-396`). Sem migrar isso para os tokens, um toggle de tema não muda quase nada. | **Baixo-Médio** — conforto e percepção de produto acabado. Não desbloqueia nenhuma tarefa nem corrige nenhum erro. O NPS > 90 do PRD é a única justificativa formal, e é indireta. | **Médio** — não é a troca de um toggle: é migrar as cores literais para tokens em toda a `page.jsx`, com risco de regressão visual em componente sem teste de UI. | **Média-Baixa** |

> **Custo de infraestrutura: zero.** CSS e preferência no localStorage.
>
> **Recomendação de sequenciamento:** este é o item com pior razão valor/esforço da lista, apesar de ser um dos dois explicitamente prometidos no PRD. Sugiro deixar para depois dos blocos 1 e 2, ou aproveitá-lo como carona de alguma refatoração maior da `page.jsx` (o arquivo já tem 531 linhas com componentes, utilitários e página no mesmo módulo). Empacotar dark mode com ZC-01, ZC-02 e ZC-04, que tocam o mesmo `ProcedureCard`, reduz bastante o custo marginal.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-14 | **PWA instalável (somente manifest, sem cache offline).** Ícone na tela inicial do celular e abertura em modo standalone, sem loja de aplicativos. | Não existe `public/`, `manifest.json` nem service worker no projeto; o `layout.jsx` declara apenas `title` e `description` (`src/app/layout.jsx:3-6`). Que o uso em celular é real e não hipótese está documentado no próprio código: "comum ao digitar rápido no celular" (`supabase/schema.sql:205-206`, justificativa da busca sem acento). | **Baixo-Médio** — o ganho sobre um simples atalho de navegador é modesto: tela cheia e ícone. | **Baixo** — um `manifest.json`, o export `metadata.manifest` do Next e um jogo de ícones (a produção dos ícones é o item mais custoso, e é design, não código). | **Média-Baixa** |

> **Custo de infraestrutura: zero.** Arquivos estáticos servidos pelo mesmo deploy da Vercel.
>
> **Escopo deliberadamente reduzido: sem service worker e sem cache offline de resultados.** Um app de precificação que serve valor cacheado depois de uma atualização de edição ou de uma correção de import produz faturamento errado com aparência de normalidade. O risco de dado obsoleto silencioso é desproporcional ao ganho de latência. Se offline entrar em pauta um dia, deve ser tratado como decisão de produto própria, com estratégia explícita de invalidação, e não como efeito colateral de "instalar o PWA".

---

## 4. Inteligência sobre dado que já está sendo coletado

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-15 | **Relatório de buscas sem resultado a partir de `search_events`.** O dado já é gravado e hoje só serve, informalmente, ao time técnico. Vira insumo direto de negócio: o que a equipe procura e não acha. | `supabase/schema.sql:127-142` (tabela), `src/app/api/search/route.js:50-61,177-179` (gravação best-effort). A tabela tem política de RLS só de `insert`, mas as rotas usam `SUPABASE_SERVICE_ROLE_KEY` (`route.js:77`), que ignora RLS, então a leitura é viável sem tocar em política nenhuma. | **Médio** — fecha o ciclo de melhoria com dado real em vez de achismo, que é justamente a justificativa registrada no item 1.4 do `opportunity-mapping.md`. | **Baixo** — uma agregação por termo com contagem. | **Média** |

> **Custo de infraestrutura: zero.** Query de leitura sobre tabela existente.
>
> **Três limitações reais que reduzem o escopo do candidato original.** Primeira: **"termos mais buscados" e "procedimentos mais consultados" não são obteníveis hoje.** Só buscas vazias são gravadas, e sempre com `teve_resultado: false` fixo (`route.js:55,177`). O painel proposto originalmente tinha três seções e só uma é sustentada pelo dado existente. Segunda: enquanto ZC-03 não for resolvido, uma parcela desconhecida das falhas reais está sendo mascarada pelo fallback semântico sem limiar e nem chega a ser gravada, o que enviesa o relatório para baixo. Terceira: a URL é pública por decisão consciente do stakeholder, então uma rota de painel exposta na navegação entrega padrões internos de trabalho a qualquer visitante. **Recomendação: começar como consulta SQL ou script `npm run` de uso interno, não como tela.** Custa quase nada, entrega o mesmo insight e não amplia superfície pública. Se virar tela depois, que seja rota não linkada e só com agregados, nunca com termos brutos.

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-16 | **Registrar também as buscas com resultado** (uma linha de código), destravando "termos mais buscados", "procedimentos mais consultados" e a taxa real de sucesso da busca. | `src/app/api/search/route.js:177-179`: o insert só ocorre no ramo de zero resultados, embora o schema tenha `teve_resultado boolean` (`supabase/schema.sql:132`), campo que hoje nunca recebe `true`. O schema, portanto, já foi desenhado para isto; só a escrita não foi feita. | **Médio** (habilitador) — sem isso, ZC-15 fica permanentemente limitado a um terço do que foi imaginado. É o pré-requisito mais barato da lista inteira. | **Muito baixo** — mover o insert para fora do condicional, passando `teve_resultado` de verdade. | **Média-Alta** (fazer junto com ZC-15) |

> **Custo de infraestrutura: zero em serviços novos**, com uma ressalva honesta: passa a gravar uma linha por busca no Postgres em vez de só nas falhas. No volume de uma equipe de faturamento (dezenas a centenas de consultas por dia) isso é irrelevante para o plano do Supabase, mas a tabela cresce indefinidamente. Sugiro decidir a política de retenção já na implementação (por exemplo, expurgo de eventos com mais de 12 meses), para não virar dívida silenciosa.

---

## 5. Micro-itens (agrupáveis numa única story de higiene)

| # | Oportunidade | Evidência | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| ZC-17 | **Sete correções pequenas de mesma natureza.** (a) O dropdown ordena as versões por texto, então "CBHPM 3ª edição", que é a **mais antiga**, aparece por último, depois da 2018, sugerindo ser a mais nova. (b) `uco \|\| '-'` esconde um UCO igual a zero. (c) `valor_versao` (a vigência dos valores de porte) é buscado e enviado à LLM, mas não aparece no card, então o texto cita uma vigência que a ficha não mostra. (d) `capitulo` é buscado e nunca usado. (e) `QUICK_SUGGESTIONS` é uma lista fixa que poderia sair do uso real depois de ZC-16. (f) `/api/versions` é a única rota sem rate limit. (g) `index.html` e `dist/` na raiz são resquícios da app Vite anterior e apontam para `/src/main.jsx`, que não existe mais. | (a) `src/app/api/versions/route.js:25` mais `scripts/cbhpm-import/config/editions.mjs:16`; (b) `src/app/page.jsx:117`; (c) `page.jsx:173-175` contra `api/chat/route.js:76`; (d) `api/search/route.js:103`; (e) `page.jsx:258-263`; (f) `api/versions/route.js:6`; (g) raiz do repositório. | **Baixo** cada um isoladamente; juntos, um incremento perceptível de acabamento. O item (a) é o único com risco real: leva à seleção da edição errada. | **Muito baixo** | **Baixa** (exceto (a), que é **Média**) |

> **Custo de infraestrutura: zero** em todos os sete.

---

## 6. Candidatos avaliados e não recomendados como propostos

| Candidato | Veredicto | Motivo |
|---|---|---|
| "Cálculo automático do valor total do procedimento" (candidato 3 original) | **Reformulado** em ZC-11 | Porte anestésico não tem valor em reais no banco (`supabase/schema.sql:50` guarda só o código do porte) e auxiliares não somam ao honorário do cirurgião. Implementado como "total", inventaria número e violaria o Article IV. |
| PWA com cache offline (parte do candidato 9) | **Escopo cortado** em ZC-14 | Valor desatualizado servido de cache num app de faturamento é erro financeiro silencioso. Manifest sim, service worker não. |
| Painel público de insights (candidato 8) | **Reformulado** em ZC-15 e ZC-16 | Dois terços do painel imaginado não têm dado que os sustente hoje, e uma tela nova exposta numa URL sem autenticação publica padrões internos de trabalho. |
| Rate limit distribuído (Redis/Upstash) | **Fora de escopo** | O limitador atual é em memória e por instância, o que na Vercel significa que o limite real é frouxo e reinicia a cada cold start (`src/lib/rate-limit.js:1-6`, limitação já documentada no próprio arquivo). Resolver de verdade exige store compartilhado, ou seja, serviço externo novo. Fere o critério inegociável desta rodada. Registrado aqui só para não ser redescoberto como "oportunidade barata" numa próxima triagem. |
| Reintroduzir autenticação | **Não avaliado** | Decisão de stakeholder já registrada em `docs/opportunity-mapping.md:41,109`. Fora de pauta. Onde a ausência de autenticação restringe o desenho de um item (ZC-15), a restrição foi absorvida no desenho, não contestada. |

---

## Sequenciamento recomendado

**Quick wins (uma sprint, alto impacto sobre esforço muito baixo).** Os quatro primeiros tocam o mesmo `ProcedureCard` e as mesmas rotas, então fazem sentido como um lote só:

1. **ZC-02** Eliminar "R$ 0,00" onde não há valor na fonte. Maior risco financeiro da lista, menor esforço.
2. **ZC-01** Expor os campos do Capítulo 4 que já estão no banco e padronizar as colunas entre as rotas de busca.
3. **ZC-04** Parar de descartar 5 dos 10 resultados em silêncio.
4. **ZC-03** Limiar de similaridade na busca semântica, rótulo de "resultado aproximado" e registro correto da falha.
5. **ZC-12** Foco automático e atalhos de teclado. Alívio diário para quem digita o dia inteiro.
6. **ZC-08** Dizer em qual edição o código existe quando o filtro de versão zerou o resultado.
7. **ZC-16** Gravar também as buscas com resultado. Uma linha, e sem ela o item 9 nasce limitado.

**Próximo horizonte (valor claro, exige desenho antes de código):**

8. **ZC-05 + ZC-06** Consulta em lote com exportação CSV. É o item que muda a ordem de grandeza do ganho de produtividade, e o que mais precisa de validação prévia com o usuário-piloto: quantos códigos por lote, quais colunas na tabela, qual formato de CSV o sistema de destino aceita.
9. **ZC-07** Comparação do mesmo código entre as 7 edições.
10. **ZC-15** Relatório de buscas sem resultado, como script interno. Só depois de ZC-03 e ZC-16, senão mede um retrato enviesado.
11. **ZC-09** Deep link por código e edição.
12. **ZC-11** Subtotal transparente e simulador de auxiliares, com a rotulagem tratada como requisito e não como detalhe.

**Menor prioridade (fazer de carona em algo maior):**

13. **ZC-10** Histórico e favoritos em localStorage. Antes, decidir com o @pm a fusão com o item 3.2 do `opportunity-mapping.md`.
14. **ZC-17** Lote de higiene, começando pelo (a), a ordenação das edições.
15. **ZC-14** PWA somente manifest.
16. **ZC-13** Modo escuro. Prometido no PRD, mas é o pior valor por esforço da lista. Melhor destino: carona na refatoração de cores que os itens 1 a 4 já vão tocar.

---

## Confiança e verificações pendentes

Declaração de incerteza, para que o @pm saiba o que está verificado e o que é inferência.

**Confiança alta (verificado diretamente no código ou nos artefatos de parsing):** ZC-01, ZC-02, ZC-03, ZC-04, ZC-07, ZC-08, ZC-09, ZC-12, ZC-13, ZC-16, ZC-17. Os números citados (2.706 registros com campos de Radiologia e Medicina Nuclear, 2.327 com `custo_operacional` nulo, 13.682 registros do Capítulo 4) foram apurados agregando os sete arquivos `scripts/cbhpm-import/output/*-cap4-report.json`, e o total de 13.682 confere com o registrado em `docs/opportunity-mapping.md:119`.

**Confiança média (a lógica de produto está clara, a magnitude do ganho não foi medida com usuário):** ZC-05, ZC-06, ZC-10, ZC-11, ZC-14, ZC-15. Em particular, ZC-05 e ZC-06 partem do cenário de conferência de guia descrito na abertura desta análise, não de observação direta do trabalho. Recomendo confirmar com o usuário-piloto antes de dimensionar: quantos códigos por guia, com que frequência, e se o destino do CSV é planilha ou importação em sistema.

**Verificações que exigem acesso ao banco de produção e que eu não executei (leitura, sem efeito colateral):**

1. Quantas linhas têm `valor_porte is null`, o que confirma a extensão do sintoma de ZC-02 para além do Capítulo 4:
   `select capitulo, count(*) from cbhpm_procedures where valor_porte is null group by 1;`
2. Se as migrations das seções 10, 11 e 14 de `supabase/schema.sql` já foram aplicadas. `docs/opportunity-mapping.md:121-122` e `docs/stories/1.5.ux-e-busca-acento.story.md:46` as registram como ação pendente do usuário. **ZC-15 e ZC-16 dependem da seção 11 estar aplicada; se não estiver, `search_events` está vazia e os dois itens não têm sobre o que operar.** Vale checar antes de priorizar.
3. Distribuição de distância vetorial de consultas reais contra `match_cbhpm_procedures`, para calibrar o limiar de ZC-03 com dado em vez de chute.

**Sobre o brainstorm em si:** dos 9 candidatos recebidos, 8 foram validados (com 3 deles reformulados por restrição de dado ou de risco) e nenhum foi descartado por inteiro. Foram acrescentados 7 itens novos, todos ancorados em evidência de código, e os 4 de maior prioridade da lista final estão entre esses novos. Nenhum item aqui duplica o que já está implementado ou já rastreado em `docs/opportunity-mapping.md`, com a única exceção declarada de ZC-10, que se sobrepõe parcialmente ao item 3.2 de lá.

---

**Generated by:** Synkra AIOX - @analyst (Atlas)
</content>
</invoke>
