# Architecture (NazcaTracker)

Este documento e gerado automaticamente a partir do codigo atual. Fonte: `scripts/self-heal-context.js` (self-heal-context/v3).

## System Architecture

- Monolito: Express serve API e paginas estaticas no mesmo processo
- Persistencia: SQLite (better-sqlite3, sincrono)
- UI: SPA (hash routing) + paginas HTML avulsas (login/reset/institucional)

## Directory Structure

- `src/`
- `src/routes/`
- `src/routes/api/`
- `src/middleware/`
- `src/services/`
- `src/repositories/`
- `src/db/`
- `src/public/`
- `docs/`
- `scripts/`

## Application Entry Point

- `src/server.js`: chama `migrate()` e inicia `createApp()`
- `src/app.js`: configura middlewares, static, routers e error handler

## Routing Layer

- Paginas: `src/routes/pages.js`
- API: `src/routes/api/index.js` (mounts) + routers por dominio

### API Endpoints (detected)

- DELETE /api/acl/users/:id/overrides/:module
- DELETE /api/contratos-silo/arquivos/:id
- DELETE /api/contratos-silo/one
- DELETE /api/custos-lancamentos/:id
- DELETE /api/destino-regras/plantio/:id
- DELETE /api/destinos/:id
- DELETE /api/fretes/:id
- DELETE /api/motoristas/:id
- DELETE /api/participantes/:id
- DELETE /api/politicas-custos/:id
- DELETE /api/quitacoes-motoristas/:id
- DELETE /api/safras/:id
- DELETE /api/talhao-acordos/:id
- DELETE /api/talhoes/:id
- DELETE /api/tipos-plantio/:id
- DELETE /api/users/:id
- DELETE /api/vendas-sacas/:id
- DELETE /api/viagens/:id
- GET /api/acl/roles
- GET /api/acl/roles/:role/permissions
- GET /api/acl/users/:id/overrides
- GET /api/apuracao/custos-por-viagem
- GET /api/apuracao/extrato
- GET /api/apuracao/pendencias
- GET /api/apuracao/saldo/destinos
- GET /api/apuracao/saldo/participantes
- GET /api/apuracao/saldo/talhoes
- GET /api/audit-logs
- GET /api/audit-logs/:id
- GET /api/audit-logs/export.csv
- GET /api/audit-logs/page
- GET /api/audit-logs/recent-logins
- GET /api/audit-logs/stats
- GET /api/auth/can
- GET /api/auth/me
- GET /api/comunicacao/webmail
- GET /api/contratos-silo
- GET /api/contratos-silo/:id/arquivos
- GET /api/contratos-silo/arquivos/:id/download
- GET /api/contratos-silo/one
- GET /api/custos-lancamentos
- GET /api/custos-lancamentos/:id
- GET /api/destino-regras
- GET /api/destino-regras/one
- GET /api/destino-regras/plantio
- GET /api/destino-regras/plantio/:id
- GET /api/destino-regras/plantio/:id/umidade-template.xlsx
- GET /api/destino-regras/umidade-template.xlsx
- GET /api/destinos
- GET /api/destinos/:id
- GET /api/fretes
- GET /api/health
- GET /api/motoristas
- GET /api/motoristas/:id
- GET /api/notifications/preferences
- GET /api/participantes
- GET /api/participantes/:id
- GET /api/politicas-custos
- GET /api/politicas-custos/:id
- GET /api/public/talhoes-geometrias
- GET /api/public/talhoes/:id
- GET /api/public/talhoes/:id/resumo
- GET /api/quitacoes-motoristas/:id
- GET /api/quitacoes-motoristas/resumo
- GET /api/relatorios/colheita
- GET /api/relatorios/colheitas-completo.xlsx
- GET /api/relatorios/entregas-por-destino
- GET /api/relatorios/pagamento-motoristas
- GET /api/relatorios/painel
- GET /api/relatorios/resumo-talhao
- GET /api/relatorios/viagens-bruto.xlsx
- GET /api/safras
- GET /api/safras/:id
- GET /api/talhao-acordos
- GET /api/talhao-acordos/:id
- GET /api/talhao-safra
- GET /api/talhao-safra/one
- GET /api/talhoes
- GET /api/talhoes/:id
- GET /api/tipos-plantio
- GET /api/tipos-plantio/:id
- GET /api/users
- GET /api/vendas-sacas
- GET /api/vendas-sacas/:id
- GET /api/viagens
- GET /api/viagens/:id
- GET /api/viagens/next-ficha
- POST /api/acl/roles
- POST /api/acl/roles/:role/clone
- POST /api/apuracao/reapurar
- POST /api/auth/change-password
- POST /api/auth/forgot
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/reset
- POST /api/contratos-silo
- POST /api/contratos-silo/:id/arquivos
- POST /api/custos-lancamentos
- POST /api/destino-regras
- POST /api/destino-regras/umidade-import-preview
- POST /api/destinos
- POST /api/fretes
- POST /api/fretes/bulk-delete-safra
- POST /api/fretes/bulk-save
- POST /api/fretes/bulk-upsert
- POST /api/fretes/copiar-safra
- POST /api/motoristas
- POST /api/participantes
- POST /api/politicas-custos
- POST /api/quitacoes-motoristas
- POST /api/safras
- POST /api/talhao-acordos
- POST /api/talhao-safra
- POST /api/talhoes
- POST /api/talhoes/geometry-bulk-apply
- POST /api/talhoes/geometry-bulk-preview
- POST /api/talhoes/geometry-preview
- POST /api/tipos-plantio
- POST /api/users
- POST /api/vendas-sacas
- POST /api/viagens
- POST /api/viagens/comparar-destinos
- POST /api/viagens/preview
- POST /api/viagens/recalcular-todas
- PUT /api/acl/roles/:role/permissions/:module
- PUT /api/acl/users/:id/overrides/:module
- PUT /api/custos-lancamentos/:id
- PUT /api/destino-regras/plantio/:id
- PUT /api/destinos/:id
- PUT /api/motoristas/:id
- PUT /api/notifications/preferences
- PUT /api/participantes/:id
- PUT /api/politicas-custos/:id
- PUT /api/quitacoes-motoristas/:id
- PUT /api/safras/:id
- PUT /api/safras/:id/painel
- PUT /api/talhao-acordos/:id
- PUT /api/talhoes/:id
- PUT /api/tipos-plantio/:id
- PUT /api/users/:id
- PUT /api/users/:id/password
- PUT /api/vendas-sacas/:id
- PUT /api/viagens/:id
- PUT /api/viagens/:id/motorista

## Middleware Layer

- `helmet` CSP (img-src https/data, frame-src Google Maps)
- `cors` allowlist via `CORS_ORIGIN`
- `compression` (quando habilitado no app)
- `pino-http` + `x-request-id`
- `express.json` (1mb)
- `enforceSameOrigin` para metodos mutantes em /api quando header Origin existe
- `rateLimit` (memoria) quando habilitado
- `authenticate` (anexa req.user via cookie) + `requireAuth` dentro do api router
- Custom middlewares (detectados via imports em `src/app.js`):
  - requestId (src/middleware/requestId.js)
  - errorHandler (src/middleware/errorHandler.js)
  - rateLimit (src/middleware/rateLimit.js)
  - enforceSameOrigin (src/middleware/sameOrigin.js)

## Controllers

- Controllers sao os handlers em `src/routes/api/*.js` (Express Router)

## Services

- `src/services/auditService.js`
- `src/services/auditService.test.js`
- `src/services/deleteDependencyService.js`
- `src/services/emailNotificationService.js`
- `src/services/mailer.js`
- `src/services/producaoService.js`
- `src/services/quitacaoMotoristasService.js`
- `src/services/relatoriosService.js`
- `src/services/roleSyncService.js`
- `src/services/talhaoGeometryService.js`
- `src/services/viagemService.js`
- `src/services/xlsxExportService.js`
- `src/services/xlsxExportService.test.js`

## Repositories

- `src/repositories/aclRepo.js`
- `src/repositories/auditLogRepo.js`
- `src/repositories/contratoSiloArquivoRepo.js`
- `src/repositories/contratoSiloRepo.js`
- `src/repositories/custoLancamentoRepo.js`
- `src/repositories/destinoRegraRepo.js`
- `src/repositories/destinoRepo.js`
- `src/repositories/emailNotificationSentRepo.js`
- `src/repositories/freteRepo.js`
- `src/repositories/motoristaQuitacaoRepo.js`
- `src/repositories/motoristaRepo.js`
- `src/repositories/participanteRepo.js`
- `src/repositories/participanteSacasMovRepo.js`
- `src/repositories/passwordResetRepo.js`
- `src/repositories/plantioTipoRepo.js`
- `src/repositories/politicaCustosRepo.js`
- `src/repositories/safraRepo.js`
- `src/repositories/talhaoAcordoRepo.js`
- `src/repositories/talhaoRepo.js`
- `src/repositories/talhaoSafraRepo.js`
- `src/repositories/userNotificationPrefRepo.js`
- `src/repositories/usuarioRepo.js`
- `src/repositories/usuarioSessaoRepo.js`
- `src/repositories/vendaSacaRepo.js`
- `src/repositories/viagemRepo.js`
- `src/repositories/viagemTalhaoRepo.js`

## Database Layer

- Schema: `src/db/migrate.js` (tabelas detectadas: 34)
- Principais tabelas: audit_log, contrato_silo, contrato_silo_arquivo, contrato_silo_faixa, custo_lancamento, destino, destino_regra, destino_regra_plantio, email_notification_sent, frete, motorista, motorista_quitacao, participante, participante_sacas_mov, password_reset_token, plantio_tipo, politica_custos, politica_custos_regra, role, role_permission, ...

## Authentication Flow

- Login: `POST /api/auth/login` cria sessao e seta cookie HttpOnly
- Logout: `POST /api/auth/logout` invalida token
- Reset: `POST /api/auth/forgot` e `POST /api/auth/reset`

## Permission System

- ACL: `src/auth/acl.js` (Modules/Actions) consultando DB via `aclRepo`
- Fallback: `src/auth/permissions.js` (role -> lista de perms)

## Validation Layer

- Zod: schemas em `src/validation/apiSchemas.js`
- Middleware: `src/middleware/validate.js` (body/query/params)

## Error Handling

- `src/middleware/errorHandler.js`: AppError (status) + ZodError (400) + fallback 500

## Logging

- Pino + pino-http (`src/logger.js`) com `x-request-id`

## Export System

- XLSX: endpoints em `src/routes/api/relatorios.js` + `src/services/xlsxExportService.js`
- CSV: auditoria em `GET /api/audit-logs/export.csv`

## Notification System

- Preferencias: `GET|PUT /api/notifications/preferences`
- Email: `nodemailer` (opcional via SMTP)

## Audit System

- `src/services/auditService.js` escreve em `audit_log`
