# Project Context (NazcaTracker)

Este documento e gerado automaticamente a partir do codigo atual. Fonte: `scripts/self-heal-context.js` (self-heal-context/v3).

## Overview

- Produto (UI): NazcaTracker
- Stack: Node.js (ESM) + Express + SQLite (better-sqlite3) + UI em JS puro (SPA por hash) + paginas HTML isoladas (login/reset e paginas publicas)
- Objetivo: registrar viagens de colheita (viagem/ficha), aplicar regras/contratos por safra+destino+tipo_plantio, calcular sacas/custos e gerar relatorios

## Main Modules

- Contratos do silo: arquivos (upload/download/delete) (mount: /api/, router: src/routes/api/contratosSiloArquivos.js)
- Permissoes/ACL (mount: /api/acl, router: src/routes/api/acl.js)
- Producao: apuracao (mount: /api/apuracao, router: src/routes/api/apuracao.js)
- Auditoria (mount: /api/audit-logs, router: src/routes/api/auditLogs.js)
- Autenticacao (API /api/auth/*) (mount: /api/auth, router: src/routes/api/auth.js)
- Comunicacao (webmail) (mount: /api/comunicacao, router: src/routes/api/comunicacao.js)
- Contratos do silo (mount: /api/contratos-silo, router: src/routes/api/contratosSilo.js)
- Producao: custos manuais (mount: /api/custos-lancamentos, router: src/routes/api/custosLancamentos.js)
- Regras do destino (mount: /api/destino-regras, router: src/routes/api/destinoRegras.js)
- Destinos (mount: /api/destinos, router: src/routes/api/destinos.js)
- Fretes (mount: /api/fretes, router: src/routes/api/fretes.js)
- Motoristas (mount: /api/motoristas, router: src/routes/api/motoristas.js)
- Notificacoes (preferencias) (mount: /api/notifications, router: src/routes/api/notifications.js)
- Producao: participantes (mount: /api/participantes, router: src/routes/api/participantes.js)
- Producao: politicas de custos (mount: /api/politicas-custos, router: src/routes/api/politicasCustos.js)
- API publica (/api/public/*) (mount: /api/public, router: src/routes/api/public.js)
- Quitacoes motoristas (mount: /api/quitacoes-motoristas, router: src/routes/api/quitacoesMotoristas.js)
- Relatorios + export (mount: /api/relatorios, router: src/routes/api/relatorios.js)
- Safras (mount: /api/safras, router: src/routes/api/safras.js)
- Producao: acordos por talhao (mount: /api/talhao-acordos, router: src/routes/api/talhaoAcordos.js)
- Area colhida (talhao x safra) (mount: /api/talhao-safra, router: src/routes/api/talhaoSafra.js)
- Talhoes (mount: /api/talhoes, router: src/routes/api/talhoes.js)
- Tipos de plantio (mount: /api/tipos-plantio, router: src/routes/api/tiposPlantio.js)
- Usuarios (admin) (mount: /api/users, router: src/routes/api/users.js)
- Producao: vendas (sacas) (mount: /api/vendas-sacas, router: src/routes/api/vendasSacas.js)
- Colheita (viagens) (mount: /api/viagens, router: src/routes/api/viagens.js)
- Site institucional publico (/institucional/*)
- Pagina publica de talhao (/talhao.html?id=... + /api/public/*)

## Database

- Banco: SQLite (arquivo em `DB_PATH`, default `./data/app.db`)
- Migrations/schema: runtime em `src/db/migrate.js`
- Tabelas (detectadas): 34

## Authentication

- Sessao: cookie HttpOnly (configuravel por `SESSION_COOKIE_NAME`) + tabela `usuario_sessao`
- Reset senha: `password_reset_token` + endpoints `/api/auth/forgot` e `/api/auth/reset`
- Feature flag: `AUTH_ENABLED`

## Permissions

- ACL por modulo/acao: tabelas `role_permission` e `user_permission` (com fallback legado por role)

## Core Workflows

- Cadastros: safras/talhoes/destinos/motoristas/tipos-plantio
- Config: fretes por safra+motorista+destino; regras do destino; contratos por faixas
- Colheita: preview -> salvar; rateio por talhao (viagem_talhao); trava por contrato
- Relatorios: painel, resumo por talhao, entregas por destino, pagamento motoristas; export XLSX
- Quitacoes: pagamentos por periodo + resumo
- Producao: ledger em sacas (participantes/acordos/custos/vendas) + apuracao/reapurar

## Dependencies

- Versao do app: 1.1.0
- Dependencias criticas:
  - express@^5.2.1
  - better-sqlite3@^12.6.2
  - zod@^4.3.6
  - helmet@^8.1.0
  - pino@^10.3.1
  - pino-http@^11.0.0
  - xlsx@^0.18.5
  - nodemailer@^6.10.1

## Environment Variables

Fonte: `.env.example`

- `PORT`
- `HOST`
- `DB_PATH`
- `UMIDADE_BASE`
- `CORS_ORIGIN`
- `TRUST_PROXY`
- `AUTH_ENABLED`
- `SESSION_TTL_DAYS`
- `SESSION_COOKIE_NAME`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_API_WINDOW_MS`
- `RATE_LIMIT_API_MAX`
- `RATE_LIMIT_LOGIN_WINDOW_MS`
- `RATE_LIMIT_LOGIN_MAX`
- `PUBLIC_BASE_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Lessons Learned

- Migrations devem ser defensivas (checar colunas antes de ALTER/INDEX) para nao quebrar o start.
- Validacao e centralizada em Zod via middleware (body/query/params).
- ZodError retorna 400 com details (path/message); padronizar tratamento no frontend.
