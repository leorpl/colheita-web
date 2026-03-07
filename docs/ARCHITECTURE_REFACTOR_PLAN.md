# Architecture Refactor Plan (NazcaTraker)

Este documento propoe um plano de reestruturacao/modularizacao com base no codigo atual.
Nao executa refatoracoes automaticamente; serve como guia seguro e incremental.

## 1) Diagnostico do estado atual

Arquitetura geral (hoje)

- Monolito Express + SQLite (better-sqlite3, sincrono)
- Backend organizado por "tipo tecnico" (routes/services/repositories/validation), nao por dominio
- Frontend em JS puro, SPA por hash, concentrada em um unico arquivo grande
- Migrate/schema em runtime em um unico arquivo grande

Hotspots por tamanho (linhas)

- `src/public/app.js` ~9547 linhas (SPA inteira em um arquivo)
- `src/services/viagemService.js` ~1587 linhas (orquestracao + rateio + queries + regras)
- `src/db/migrate.js` ~1263 linhas (schema/migrations runtime)
- `src/validation/apiSchemas.js` ~762 linhas (Zod centralizado)
- `src/services/relatoriosService.js` ~666 linhas (dashboard + relatorios + export)
- `src/services/producaoService.js` ~539 linhas (ledger/apuracao/reapurar + queries)
- `src/repositories/viagemRepo.js` ~395 linhas (queries de colheita)
- `src/routes/api/destinoRegras.js` ~389 linhas (regras + validacoes + regras de negocio + queries)

Sinais de acoplamento / responsabilidades misturadas

- Services com SQL direto (ex.: `src/services/viagemService.js`, `src/services/producaoService.js`, `src/services/relatoriosService.js`).
  - Impacto: dificulta testes unitarios (mock de DB), dificulta evolucao incremental (mudanca de query e regra no mesmo arquivo).
- Rotas com regras de negocio e SQL (ex.: `src/routes/api/destinoRegras.js`).
  - Impacto: controller vira "service", e a camada de service perde consistencia.
- Validacao centralizada em um unico arquivo (`src/validation/apiSchemas.js`).
  - Impacto: qualquer mudanca de dominio exige carregar o arquivo inteiro; dificulta analise incremental por IA.
- Frontend SPA monolitico (`src/public/app.js`).
  - Impacto: alta complexidade cognitiva; pouca separacao por pagina/dominio; manutencao e testes ficam caros.

O que esta bem encaminhado (pontos positivos)

- Repositorios existem e sao usados em boa parte do codigo (padrao repetivel).
- Existe um nucleo de dominio pequeno e puro para calculos (`src/domain/*`).
- Validacao e padronizada via middleware (Zod) e `ZodError` vira 400 com `details`.
- Ha um mecanismo automatizado de contexto (self-heal) para manter docs sincronizadas.

## 2) Dominios funcionais (propostos)

Baseado nos endpoints/servicos/repos atuais:

- auth: login/logout/me/forgot/reset, sessao/cookie
- acl (permissions): roles, role_permission, user_permission, overrides
- users: usuarios admin, password update
- audit: audit_log, export CSV, stats
- catalog:
  - safras
  - talhoes + talhao_safra
  - destinos
  - motoristas
  - tipos_plantio
- freight: fretes por safra+motorista+destino
- rules: regras do destino (destino_regra_plantio + faixas de umidade)
- contracts: contrato_silo + faixas + arquivos (upload/download)
- harvest: viagens/colheita, preview, rateio por talhao, recalculos
- production: participantes, politicas de custos, acordos, custos_lancamentos, vendas_sacas, apuracao/reapurar (ledger)
- reports: painel e relatorios (incl. export XLSX)
- notifications: preferencias + email (mailer)
- public: endpoints publicos (/api/public) + pagina publica talhao

## 3) Nova estrutura de diretorios (modular por dominio)

Objetivo: permitir que cada modulo seja entendido isoladamente.

Proposta:

```
src/
  core/
    http/                  # createApp, server bootstrap
    config/                # env + config parsing
    database/              # db handle + transaction helpers + migrate orchestrator
    middleware/            # requestId, sameOrigin, rateLimit, validate, errorHandler
    logging/               # logger, pino-http wiring
    security/              # auth cookie/session wiring (parte cross-cutting)
    errors/                # AppError helpers

  shared/
    domain/                # calculos/normalize (puro)
    validation/            # helpers de Zod compartilhados
    utils/                 # datas, numericos, strings, etc

  modules/
    auth/
      routes/
      controllers/
      services/
      repositories/
      validators/

    acl/
    users/
    audit/
    catalog/
      safras/
      talhoes/
      destinos/
      motoristas/
      tiposPlantio/
      talhaoSafra/

    freight/
    rules/
    contracts/
    harvest/
    production/
    reports/
    notifications/
    public/

  routes/                  # apenas composition/root mounts
  public/                  # assets e SPA (ver plano de modularizacao do frontend)
```

Notas

- `src/routes/api/*` passa a ser apenas composition (montagem) ou wrappers temporarios.
- Cada modulo expõe um `router` (Express Router) e seus schemas Zod locais.

## 4) Camadas e regras de dependencias

Camadas (padrão alvo)

- Routes -> Controllers -> Services -> Repositories -> Database

Regras praticas

- Controllers:
  - somente adaptacao HTTP (req/resp), status codes, traducoes de erro
  - nao devem conter SQL, nem regras de negocio complexas
- Services:
  - regras de negocio, orquestracao, transacoes, regras de permissao de dominio
  - podem chamar repositorios; evitam SQL inline
- Repositories:
  - somente SQL e mapeamento de linhas -> objetos
  - sem dependencias de Express
- Validators:
  - Zod schemas por dominio + normalizacoes de input (parsing/coercion)

Regras de acoplamento entre modulos

- Modulo A nao importa repositorio interno de B.
- Integracoes entre modulos ocorrem via services publicos (interfaces) ou eventos.
- Tudo cross-cutting vai para `src/core/*` ou `src/shared/*`.

## 5) Plano para reduzir tamanho dos arquivos (alvos imediatos)

Backend

- `src/services/viagemService.js`:
  - extrair rateio (ex.: `modules/harvest/services/rateioService.js`)
  - extrair queries de listagem (ex.: `modules/harvest/repositories/viagemQueryRepo.js`)
  - extrair compra/contrato (ex.: `modules/contracts/services/contratoPricingService.js`)
  - manter `modules/harvest/services/viagemService.js` apenas como orquestrador

- `src/services/producaoService.js`:
  - separar precificacao (VWAP) em `production/services/pricingService.js`
  - separar `reapurarSafra` em `production/services/reapurarService.js`
  - separar funcoes de alocacao/percentuais em `production/domain/*` (puro)

- `src/services/relatoriosService.js`:
  - separar `painel()` em `reports/services/painelService.js`
  - separar relatórios colheita em `reports/services/colheitaReportService.js`
  - separar export/formatacao em `reports/services/exportService.js` (usando `xlsxExportService`)

- `src/validation/apiSchemas.js`:
  - dividir em `modules/*/validators/*.js` (AuthSchemas, ViagemSchemas, ProducaoSchemas, etc.)
  - manter `src/shared/validation/commonSchemas.js` para `IdParam`, datas, etc.

- `src/routes/api/destinoRegras.js`:
  - mover bloqueios/regra-em-uso para um service do modulo `rules`
  - manter rota fina: chama service, retorna JSON

Frontend

- `src/public/app.js` (SPA):
  - migrar para ES modules sem bundler:
    - `src/public/app/api.js` (wrapper fetch + tratamento de ZodError)
    - `src/public/app/state/*` (cache/lookups)
    - `src/public/app/components/*` (table sort, dialog, toast, popovers)
    - `src/public/app/pages/*` (uma pagina por rota/hash)
    - `src/public/app/index.js` (bootstrap + router)
  - objetivo: cada pagina/dominio ser carregavel/entendivel em isolamento.

## 6) Padronizacao de nomenclatura

- JS/Node:
  - arquivos: `camelCase.js` (mantem padrao atual)
  - funcoes: `camelCase`
  - constantes: `UPPER_SNAKE`

- HTTP:
  - rotas: manter kebab-case existente (ex.: `/api/destino-regras`, `/api/quitacoes-motoristas`)
  - evitar mudanca de endpoint durante refatoracao (compatibilidade)

- DB:
  - tabelas/colunas: `snake_case` (mantem)
  - indices: `idx_<tabela>_<campos>`

## 7) Dependencias criticas e riscos

Dependencias externas criticas

- `express@5`: mudancas pequenas em middleware/routers podem afetar fluxo; manter testes de rotas essenciais.
- `better-sqlite3`: sincrono; refatoracao de transacoes precisa ser consistente.
- `zod`: qualquer split deve preservar coercions e normalizacoes atuais.
- `xlsx`: outputs precisam ser idempotentes (mesmos headers/ordem).
- Auth por cookie/sessao: risco alto de regressao; isolar no modulo auth/core.

Riscos de refatoracao

- Mudanca de imports ESM (caminhos relativos) pode quebrar runtime silenciosamente.
- Reorganizacao de queries pode alterar ordering/joins e mudar relatorios.
- Frontend split sem bundler: precisa validar carregamento e caching em browsers.

Mitigacoes

- Fazer migracao por "wrappers" (ver plano) para evitar alterar todos imports de uma vez.
- Adicionar testes pequenos por fase (principalmente harvest/contracts/production).
- Validar endpoints criticos via smoke test automatizado (rotas + auth).

## 8) Plano de migracao segura (fases)

Fase 0 — Preparacao (sem mudar comportamento)

- Criar `docs/ARCHITECTURE_REFACTOR_PLAN.md` (este arquivo).
- Definir limites e regras de dependencias.
- Criar helpers de infraestrutura que serao reutilizados (ex.: `transaction(db, fn)`), sem mudar chamadas existentes.

Fase 1 — Criar esqueleto modular + wrappers

- Criar `src/modules/*` e mover 1 dominio pequeno (ex.: notifications) primeiro.
- Manter compatibilidade criando wrappers:
  - `src/routes/api/notifications.js` passa a re-exportar o router do novo modulo.
  - `src/services/*` antigos podem virar re-exports temporarios.

Fase 2 — Modularizar validacao

- Migrar schemas de 1 dominio por vez para `modules/<dominio>/validators/*`.
- Manter `src/validation/apiSchemas.js` como "facade" temporario re-exportando os novos schemas.

Fase 3 — Extrair SQL de services para repos

- Para cada modulo, garantir: queries complexas ficam em repositorios.
- Exemplo: `harvest` (listagem + joins) e `production` (reapurar) primeiro.

Fase 4 — Modularizar frontend

- Converter `index.html` para carregar `app/index.js` como `type="module"`.
- Split incremental: primeiro extrair `api()` + componentes; depois pages.
- Garantir que nao muda endpoints nem payloads.

Fase 5 — Consolidacao

- Remover wrappers antigos depois que imports e mounts apontarem para os modulos.
- Rodar `npm run context:selfheal` para manter docs oficiais em dia.

## 9) Roadmap (tarefas pequenas, testaveis)

Sugestao de execucao (ordem por risco/valor)

1) Notifications + Mailer (baixo risco): modularizar e criar padrao do modulo.
2) Auth (alto risco, mas bem delimitado): isolar sessao/cookie/reset.
3) ACL/Users (medio): separar permissao e admin.
4) Harvest + Contracts (alto valor): dividir `viagemService` e regras de contrato.
5) Production (alto risco): separar reapurar/ledger.
6) Reports/Exports (medio): separar painel e exports.
7) Frontend SPA (alto esforço): split em ES modules por pagina.

## 10) Impacto esperado

- Menor complexidade por arquivo e por dominio.
- Testes mais simples (services puros, repos isolados).
- Evolucao incremental por IA (carregar apenas `modules/harvest/*` quando necessario).
- Reducao de regressao por padronizar camadas e dependencias.
