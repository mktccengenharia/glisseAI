# PRD - Sistema de Consulta Inteligente de Tabelas Médicas (CBHPM RAG)

**Version:** 1.0.0  
**Status:** Draft / Pending Review  
**Owner:** @pm (Morgan - Product Manager)  
**Date:** 2026-08-11  

---

## Stakeholders

- Setor de Cobranças Médicas (Usuários Finais / Faturistas)
- Coordenação de Faturamento Hospitalar / Ambulatorial
- Equipe de TI e Desenvolvimento (AIOX Squad)

---

## Problem Statement

Atualmente, a equipe do setor de cobranças médicas enfrenta retrabalho e perda de tempo ao realizar consultas manuais em tabelas CBHPM (arquivos PDF, planilhas Excel ou manuais impressos). Para cada item faturado, o colaborador precisa:
1. Identificar a versão da tabela aplicável ao convênio/operadora.
2. Buscar o código numérico do procedimento ou procurar por palavra-chave na descrição.
3. Consultar o **porte** do procedimento.
4. Cruzar o porte para descobrir a valoração em reais (R$) ou UCO (Unidade de Custo Operacional).
5. Verificar se possui incidência de filme/chapa ou custo adicional.

Esse processo manual gera lentidão, erros de digitação e inconsistência de valoração nas contas médicas.

---

## Goals

1. **Consulta Instantânea (Sub-segundo):** Permitir a busca direta por código (ex: `3.01.01.00-7`) ou por texto natural (ex: `resecção de próstata`) com resposta imediata.
2. **Precisão Numérica de 100%:** Garantir que valores monetários, porte e UCO sejam recuperados deterministicamente via busca estruturada (SQL/Index) sem alucinações da LLM.
3. **Interface "Claude-like" e Intuitiva:** Chat dinâmico combinando busca estruturada + síntese em linguagem natural clara e amigável.
4. **Suporte Multi-Tabela / Versões CBHPM:** Permitir filtrar ou alternar entre a CBHPM Nacional e variações/edições negociadas com operadoras.
5. **Aumento de Produtividade:** Reduzir em pelo menos 80% o tempo gasto por consulta de código no setor de faturamento/cobrança.

## Non-Goals

- Não fará auditoria automática de prontuários ou validação de regras de pré-autorização de convênio na V1.
- Não substituirá o sistema ERP/Faturamento principal, atuando como ferramenta de apoio/consulta de alta velocidade.

---

## User Stories

### 1. Faturista / Colaborador de Cobrança (Busca Exata por Código)

**As a** Faturista do setor de cobranças médicas,  
**I want** digitar o código de um procedimento no chat ou campo de busca rápida,  
**So that** o sistema me retorne instantaneamente a descrição completa, o porte, o valor do porte, a UCO, incidência de filme e a versão da tabela correspondente.

### 2. Faturista / Colaborador de Cobrança (Busca Semântica por Nome)

**As a** Faturista,  
**I want** descrever o procedimento com minhas próprias palavras ou termos técnicos parciais,  
**So that** o RAG encontre o procedimento correspondente na CBHPM e me exiba as opções com seus respectivos códigos e portes.

### 3. Gestor de Cobrança / Administrador

**As a** Gestor do setor de faturamento,  
**I want** importar novas edições da tabela CBHPM (em CSV, Excel ou PDF),  
**So that** o sistema permaneça sempre atualizado com as últimas negociações e tabelas nacionais.

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-01** | **Busca Híbrida (Estruturada + RAG):** Pesquisa exata por código numérico e busca semântica por texto com embeddings/fuzzy match. | P1 |
| **FR-02** | **Ficha Detalhada do Procedimento:** Exibição clara de Código, Descrição, Porte, Valor do Porte (R$), UCO, Valor da UCO (R$), Filme/Custo Operacional e Versão da Tabela. | P1 |
| **FR-03** | **Interface Web Chat & Quick Search:** UI moderna com canal de chat conversacional ("Claude-like") e barra de pesquisa rápida de atalho. | P1 |
| **FR-04** | **Seleção de Versão da Tabela:** Filtro/Dropdown para selecionar a versão da CBHPM (ex: CBHPM 2018, CBHPM 2020, CBHPM Nacional Atual). | P1 |
| **FR-05** | **Importador de Tabelas (Admin Data Loader):** Módulo para carga e parsing de arquivos de tabela médica (CSV / Excel / PDF). | P2 |
| **FR-06** | **Cópia Rápida (1-Click Copy):** Botão para copiar o código e valores formatados para a área de transferência para colar no sistema de faturamento. | P2 |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| **Performance** | Tempo de resposta para busca estruturada | < 200 ms |
| **Performance** | Tempo total de resposta da síntese LLM/RAG | < 2 segundos |
| **Accuracy** | Precisão de dados numéricos (Porte, UCO, Valores) | 100% determinístico (SQL/JSON Index) |
| **Usability** | Design intuitivo com suporte a modo escuro/claro e navegação por teclado | NPS > 90 entre os faturistas |
| **Security** | Aplicação web de uso interno isolada e segura | Acesso corporativo restrito |

---

## Technical Architecture & RAG Strategy

```
[ Usuário / Faturista ]
          │
          ▼
[ Web Frontend (HTML/JS/CSS Premium) ]
          │
  ┌───────┴─────────────────────────┐
  ▼                                 ▼
[ Busca Exata / Filtro ]   [ Busca Semântica ]
  │                                 │
  ▼                                 ▼
[ Indexed DB / SQL Engine ] [ Vector Store / Embeddings ]
  │                                 │
  └───────┬─────────────────────────┘
          ▼
[ Engine de Precisão de Dados (Grounding) ]
          │ (Obtém dados exatos de Porte, UCO, R$)
          ▼
[ LLM Formatter / Chat Synthesis ]
          │
          ▼
[ Resposta Visual Clara + Card de Código ]
```

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Tempo médio de consulta por procedimento | ~ 3-5 minutos | < 5 segundos | 1 semana pós-lançamento |
| Taxa de erro de digitação/valoração de porte | Moderada (~5%) | 0% | Imediato |
| Adoção pela equipe de faturamento | 0% | 100% | 2 semanas |

---

## Milestones

### Milestone 1: PRD & Especificação da Arquitetura (Fase Atual)
- Definição do PRD e arquitetura híbrida de busca.
- Estruturação do modelo de dados para tabelas CBHPM.

### Milestone 2: Protótipo de Interface Web (UI) & Engine de Busca Local
- Desenvolvimento do Frontend Web interativo e responsivo.
- Implementação da busca determinística por Código/Nome e cálculo de Porte/UCO.

### Milestone 3: Integração do RAG & Síntese Conversacional
- Integração da camada LLM para respostas em linguagem natural ("Claude-like").
- Conexão do leitor/parser de arquivos CSV/Excel/PDF fornecidos pelo usuário.

### Milestone 4: Validação & Homologação no Setor de Cobranças
- Teste com dados reais da tabela CBHPM fornecida pelo usuário.
- Ajustes finais e entrega para uso diário.

---

## Open Questions

- [ ] **Arquivos Iniciais:** O usuário fornecerá a tabela CBHPM em CSV, Excel ou PDF para carga inicial? (Pronto para receber os arquivos no sistema).
- [ ] **Configuração da UCO:** O valor em reais da UCO e do Porte é fixo nacional ou customizável por contrato de convênio?

---

**Generated by:** Synkra AIOX - @pm (Morgan)  
**Template Version:** prd-2.0  
