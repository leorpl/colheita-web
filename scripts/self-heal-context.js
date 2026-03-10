#!/usr/bin/env node
// Self-healing project context
// Updates official docs to match the current codebase.
// Official context files:
// - docs/PROJECT_CONTEXT.md
// - docs/ARCHITECTURE.md
// Also maintains:
// - docs/TASKS_OFICIAL.md
// - docs/CHANGELOG.md
// - docs/LIÇÕESAPRENDIDAS.MD
// - docs/RELEASE_CHECKLIST.md

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const args = new Set(process.argv.slice(2))
const MODE_CHECK = args.has('--check')
const MODE_WRITE = !MODE_CHECK

const ROOT = path.resolve(process.cwd())
const DOCS_DIR = path.join(ROOT, 'docs')
const SRC_DIR = path.join(ROOT, 'src')
const SCRIPT_ID = 'self-heal-context/v3'

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function writeText(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, s, 'utf8')
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex')
}

function listFiles(dir, { exts = null } = {}) {
  const out = []
  function walk(d) {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const abs = path.join(d, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.isFile()) {
        if (exts) {
          const ext = path.extname(e.name).toLowerCase()
          if (!exts.includes(ext)) continue
        }
        out.push(abs)
      }
    }
  }
  walk(dir)
  return out
}

function parseEnvExample(filePath) {
  const txt = readText(filePath)
  if (!txt) return []
  const keys = []
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const m = s.match(/^([A-Z0-9_]+)\s*=/)
    if (m) keys.push(m[1])
  }
  return [...new Set(keys)]
}

function parsePackageJson(filePath) {
  const txt = readText(filePath)
  if (!txt) return null
  try {
    return JSON.parse(txt)
  } catch {
    return null
  }
}

function normalizeJoinPath(...parts) {
  const s = parts
    .filter((p) => p !== null && p !== undefined)
    .map((p) => String(p))
    .join('/')
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
  // ensure single leading slash
  let out = s.startsWith('/') ? s : `/${s}`
  out = out.replace(/\/+/g, '/')
  if (out.length > 1) out = out.replace(/\/+$/, '')
  return out
}

function extractJsExports(filePath, { pattern } = {}) {
  const txt = readText(filePath)
  if (!txt) return []
  const rx = pattern || /export\s+const\s+([A-Za-z0-9_]+)/g
  const out = []
  for (const m of txt.matchAll(rx)) {
    out.push(m[1])
  }
  return [...new Set(out)]
}

function parseApiIndex(apiIndexPath) {
  const txt = readText(apiIndexPath)
  if (!txt) return null

  const imports = []
  for (const m of txt.matchAll(/import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+['"](.+?)['"]/g)) {
    const varName = m[1]
    const rel = m[2]
    const abs = path.resolve(path.dirname(apiIndexPath), rel)
    imports.push({ varName, rel, abs })
  }

  const mounts = []
  for (const m of txt.matchAll(/apiRouter\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
    mounts.push({ prefix: m[1], varName: m[2] })
  }

  // Some routers are mounted at '/' (prefix '/') which is valid.
  return { imports, mounts }
}

function extractRoutesFromRouterFile(filePath, { exportName = null, seen = null } = {}) {
  const visited = seen || new Set()
  if (visited.has(filePath)) return []
  visited.add(filePath)

  const txt = readText(filePath)
  if (!txt) return []

  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']
  const methodAlt = methods.join('|')
  const rx = new RegExp(
    String.raw`\b\w+Router\.(?:${methodAlt})\(\s*(['"\`])([^'"\`]+)\1`,
    'g',
  )
  const out = []
  for (const m of txt.matchAll(rx)) {
    const method = m[0].match(new RegExp(String.raw`\.(?:${methodAlt})\(`))?.[0] || ''
    const verb = method.replace(/[.(]/g, '').toUpperCase()
    out.push({ method: verb, path: m[2] })
  }

  if (out.length) return out

  // If this file is a thin re-export wrapper, follow it.
  // Example: export { notificationsRouter } from '../../modules/notifications/routes/notificationsRouter.js'
  if (exportName) {
    const rxRe = new RegExp(
      String.raw`export\s+\{[^}]*\b${exportName}\b[^}]*\}\s+from\s+['"](.+?)['"]`,
      'g',
    )
    const m = rxRe.exec(txt)
    if (m && m[1]) {
      const abs = path.resolve(path.dirname(filePath), m[1])
      return extractRoutesFromRouterFile(abs, { exportName, seen: visited })
    }
  }

  return out
}

function extractPageRoutes(pagesPath) {
  const txt = readText(pagesPath)
  if (!txt) return []
  const rx = /pagesRouter\.get\(\s*(['"`])([^'"`]+)\1/g
  const out = []
  for (const m of txt.matchAll(rx)) out.push({ method: 'GET', path: m[2] })
  return out
}

function extractDbTablesAndIndexes(migratePath) {
  const txt = readText(migratePath)
  if (!txt) return { tables: [], indexes: [] }
  const tables = []
  for (const m of txt.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/g)) {
    const t = String(m[1] || '')
    if (t.endsWith('_new')) continue
    tables.push(t)
  }
  const indexes = []
  for (const m of txt.matchAll(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)\s+ON\s+([A-Za-z0-9_]+)/g)) {
    indexes.push({ name: m[1], table: m[2] })
  }
  return {
    tables: [...new Set(tables)].sort((a, b) => a.localeCompare(b)),
    indexes: indexes
      .map((x) => ({ name: x.name, table: x.table }))
      .sort((a, b) => `${a.table}:${a.name}`.localeCompare(`${b.table}:${b.name}`)),
  }
}

function extractAppMiddleware(appPath) {
  const txt = readText(appPath)
  if (!txt) return []
  const out = []
  for (const m of txt.matchAll(/import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+['"]\.\/middleware\/(.+?)['"]/g)) {
    out.push({ name: m[1], file: `src/middleware/${m[2]}` })
  }
  // also in use: helmet/cors/compression/pinoHttp/express.json/static
  return out
}

function pickCriticalDeps(deps) {
  const critical = ['express', 'better-sqlite3', 'zod', 'helmet', 'pino', 'pino-http', 'xlsx', 'nodemailer']
  const out = []
  for (const k of critical) {
    if (deps && Object.prototype.hasOwnProperty.call(deps, k)) out.push([k, deps[k]])
  }
  return out
}

function detectLegacyScriptIssues({ tables, scriptFiles }) {
  const issues = []
  for (const f of scriptFiles) {
    const rel = path.relative(ROOT, f).replaceAll('\\', '/')
    if (rel === 'scripts/self-heal-context.js') continue
    const txt = readText(f) || ''
    if (/INSERT\s+INTO\s+destino\s*\([^)]*\btrava_sacas\b/i.test(txt)) {
      issues.push({
        kind: 'script_schema_mismatch',
        file: rel,
        note: 'script referencia destino.trava_sacas (coluna nao existe no schema atual)',
      })
    }
  }
  return issues
}

function extractLessonsHeuristics({ migrateText, viagemServiceText, validateText, errorHandlerText }) {
  const lessons = []
  if (migrateText && migrateText.includes('hasColumn(')) {
    lessons.push('Migrations devem ser defensivas (checar colunas antes de ALTER/INDEX) para nao quebrar o start.')
  }
  if (viagemServiceText && viagemServiceText.includes('contratoExcedido') && viagemServiceText.includes('valor_compra_total')) {
    lessons.push('Contrato excedido: compra pode ficar como null; decidir regra de bloqueio vs apenas sinalizacao.')
  }
  if (validateText && validateText.includes('schema.parse')) {
    lessons.push('Validacao e centralizada em Zod via middleware (body/query/params).')
  }
  if (errorHandlerText && errorHandlerText.includes("err?.name === 'ZodError'")) {
    lessons.push('ZodError retorna 400 com details (path/message); padronizar tratamento no frontend.')
  }
  return lessons
}

function renderProjectContext(ctx) {
  const lines = []
  lines.push(`# Project Context (NazcaTraker)`)
  lines.push('')
  lines.push(`Este documento e gerado automaticamente a partir do codigo atual. Fonte: \
\`scripts/self-heal-context.js\` (${SCRIPT_ID}).`)
  lines.push('')

  lines.push('## Overview')
  lines.push('')
  lines.push(`- Produto (UI): NazcaTraker`)
  lines.push(`- Stack: Node.js (ESM) + Express + SQLite (better-sqlite3) + UI em JS puro (SPA por hash) + paginas HTML isoladas (login/reset e paginas publicas)`)
  lines.push(`- Objetivo: registrar viagens de colheita (viagem/ficha), aplicar regras/contratos por safra+destino+tipo_plantio, calcular sacas/custos e gerar relatorios`)
  lines.push('')

  lines.push('## Main Modules')
  lines.push('')
  for (const m of ctx.modules) lines.push(`- ${m}`)
  lines.push('')

  lines.push('## Database')
  lines.push('')
  lines.push(`- Banco: SQLite (arquivo em \
\`DB_PATH\`, default \
\`./data/app.db\`)`)
  lines.push(`- Migrations/schema: runtime em \
\`src/db/migrate.js\``)
  lines.push(`- Tabelas (detectadas): ${ctx.db.tables.length}`)
  lines.push('')

  lines.push('## Authentication')
  lines.push('')
  lines.push(`- Sessao: cookie HttpOnly (configuravel por \`SESSION_COOKIE_NAME\`) + tabela \`usuario_sessao\``)
  lines.push(`- Reset senha: \
\`password_reset_token\` + endpoints \
\`/api/auth/forgot\` e \
\`/api/auth/reset\``)
  lines.push(`- Feature flag: \
\`AUTH_ENABLED\``)
  lines.push('')

  lines.push('## Permissions')
  lines.push('')
  lines.push(`- ACL por modulo/acao: tabelas \
\`role_permission\` e \
\`user_permission\` (com fallback legado por role)`)
  lines.push('')

  lines.push('## Core Workflows')
  lines.push('')
  for (const w of ctx.workflows) lines.push(`- ${w}`)
  lines.push('')

  lines.push('## Dependencies')
  lines.push('')
  lines.push(`- Versao do app: ${ctx.pkg.version || 'unknown'}`)
  lines.push(`- Dependencias criticas:`)
  for (const [k, v] of ctx.criticalDeps) lines.push(`  - ${k}@${v}`)
  lines.push('')

  lines.push('## Environment Variables')
  lines.push('')
  lines.push(`Fonte: \
\`.env.example\``)
  lines.push('')
  for (const k of ctx.envKeys) lines.push(`- \
\`${k}\``)
  lines.push('')

  lines.push('## Lessons Learned')
  lines.push('')
  if (!ctx.lessons.length) lines.push('- (nenhuma registrada automaticamente)')
  for (const l of ctx.lessons) lines.push(`- ${l}`)
  lines.push('')
  return lines.join('\n')
}

function renderArchitecture(ctx) {
  const lines = []
  lines.push(`# Architecture (NazcaTraker)`)
  lines.push('')
  lines.push(`Este documento e gerado automaticamente a partir do codigo atual. Fonte: \
\`scripts/self-heal-context.js\` (${SCRIPT_ID}).`)
  lines.push('')

  lines.push('## System Architecture')
  lines.push('')
  lines.push('- Monolito: Express serve API e paginas estaticas no mesmo processo')
  lines.push('- Persistencia: SQLite (better-sqlite3, sincrono)')
  lines.push('- UI: SPA (hash routing) + paginas HTML avulsas (login/reset/institucional)')
  lines.push('')

  lines.push('## Directory Structure')
  lines.push('')
  for (const p of ctx.dirStructure) lines.push(`- \
\`${p}\``)
  lines.push('')

  lines.push('## Application Entry Point')
  lines.push('')
  lines.push(`- \
\`src/server.js\`: chama \
\`migrate()\` e inicia \
\`createApp()\``)
  lines.push(`- \
\`src/app.js\`: configura middlewares, static, routers e error handler`) 
  lines.push('')

  lines.push('## Routing Layer')
  lines.push('')
  lines.push('- Paginas: `src/routes/pages.js`')
  lines.push('- API: `src/routes/api/index.js` (mounts) + routers por dominio')
  lines.push('')
  lines.push('### API Endpoints (detected)')
  lines.push('')
  for (const r of ctx.apiRoutes) lines.push(`- ${r.method} ${r.path}`)
  lines.push('')

  lines.push('## Middleware Layer')
  lines.push('')
  lines.push('- `helmet` CSP (img-src https/data, frame-src Google Maps)')
  lines.push('- `cors` allowlist via `CORS_ORIGIN`')
  lines.push('- `compression` (quando habilitado no app)')
  lines.push('- `pino-http` + `x-request-id`')
  lines.push('- `express.json` (1mb)')
  lines.push('- `enforceSameOrigin` para metodos mutantes em /api quando header Origin existe')
  lines.push('- `rateLimit` (memoria) quando habilitado')
  lines.push('- `authenticate` (anexa req.user via cookie) + `requireAuth` dentro do api router')
  if (ctx.appMiddleware && ctx.appMiddleware.length) {
    lines.push('- Custom middlewares (detectados via imports em `src/app.js`):')
    for (const m of ctx.appMiddleware) {
      lines.push(`  - ${m.name} (${m.file})`)
    }
  }
  lines.push('')

  lines.push('## Controllers')
  lines.push('')
  lines.push('- Controllers sao os handlers em `src/routes/api/*.js` (Express Router)')
  lines.push('')

  lines.push('## Services')
  lines.push('')
  for (const f of ctx.services) lines.push(`- \
\`${f}\``)
  lines.push('')

  lines.push('## Repositories')
  lines.push('')
  for (const f of ctx.repos) lines.push(`- \
\`${f}\``)
  lines.push('')

  lines.push('## Database Layer')
  lines.push('')
  lines.push(`- Schema: \
\`src/db/migrate.js\` (tabelas detectadas: ${ctx.db.tables.length})`)
  lines.push(`- Principais tabelas: ${ctx.db.tables.slice(0, 20).join(', ')}${ctx.db.tables.length > 20 ? ', ...' : ''}`)
  lines.push('')

  lines.push('## Authentication Flow')
  lines.push('')
  lines.push('- Login: `POST /api/auth/login` cria sessao e seta cookie HttpOnly')
  lines.push('- Logout: `POST /api/auth/logout` invalida token')
  lines.push('- Reset: `POST /api/auth/forgot` e `POST /api/auth/reset`')
  lines.push('')

  lines.push('## Permission System')
  lines.push('')
  lines.push('- ACL: `src/auth/acl.js` (Modules/Actions) consultando DB via `aclRepo`')
  lines.push('- Fallback: `src/auth/permissions.js` (role -> lista de perms)')
  lines.push('')

  lines.push('## Validation Layer')
  lines.push('')
  lines.push('- Zod: schemas em `src/validation/apiSchemas.js`')
  lines.push('- Middleware: `src/middleware/validate.js` (body/query/params)')
  lines.push('')

  lines.push('## Error Handling')
  lines.push('')
  lines.push('- `src/middleware/errorHandler.js`: AppError (status) + ZodError (400) + fallback 500')
  lines.push('')

  lines.push('## Logging')
  lines.push('')
  lines.push('- Pino + pino-http (`src/logger.js`) com `x-request-id`')
  lines.push('')

  lines.push('## Export System')
  lines.push('')
  lines.push('- XLSX: endpoints em `src/routes/api/relatorios.js` + `src/services/xlsxExportService.js`')
  lines.push('- CSV: auditoria em `GET /api/audit-logs/export.csv`')
  lines.push('')

  lines.push('## Notification System')
  lines.push('')
  lines.push('- Preferencias: `GET|PUT /api/notifications/preferences`')
  lines.push('- Email: `nodemailer` (opcional via SMTP)')
  lines.push('')

  lines.push('## Audit System')
  lines.push('')
  lines.push('- `src/services/auditService.js` escreve em `audit_log`')
  lines.push('')

  return lines.join('\n')
}

function renderTasksOficial(ctx) {
  const lines = []
  lines.push('# TASKS_OFICIAL.md')
  lines.push('')
  lines.push('Gerado/atualizado automaticamente quando necessario pelo self-heal do projeto.')
  lines.push('')
  lines.push('## Prioridade Alta')
  lines.push('- [ ] Decidir e implementar o comportamento quando a entrega excede o contrato (hoje salva e apenas zera `valor_compra_*`)')
  lines.push('- [ ] Cobrir com testes os cenarios criticos de colheita/contrato/trava/rateio (node --test)')
  lines.push('')
  lines.push('## Prioridade Media')
  for (const it of ctx.detectedIssues) {
    if (it.kind === 'script_schema_mismatch') {
      lines.push(`- [ ] Ajustar ${it.file}: ${it.note}`)
    }
  }
  lines.push('- [ ] Avaliar rate limit em ambiente multi-instancia (hoje e por processo, em memoria)')
  lines.push('')
  lines.push('## Backlog')
  lines.push('- [ ] Considerar mover `sharp` para devDependency (no codigo atual aparece apenas em scripts)')
  lines.push('')
  lines.push('Somente tarefas listadas aqui sao consideradas pendentes.')
  lines.push('')
  return lines.join('\n')
}

function renderChangelog(ctx) {
  const lines = []
  lines.push('# Changelog')
  lines.push('')
  lines.push('All notable changes to this project will be documented in this file.')
  lines.push('')
  lines.push('## Unreleased')
  lines.push(`- docs: auto-sync context (${SCRIPT_ID})`) 
  lines.push('')
  lines.push(`## ${ctx.pkg.version || '0.0.0'} (estado do codigo atual)`) 
  lines.push('- (gerado automaticamente; edite manualmente se precisar de release notes humanas)')
  lines.push('')
  return lines.join('\n')
}

function renderLicoesAprendidas(ctx) {
  const autoLines = []
  autoLines.push('## Sinais automáticos atuais')
  autoLines.push('')
  for (const l of ctx.lessons.length ? ctx.lessons : ['(nenhuma registrada automaticamente)']) {
    autoLines.push(`- ${l}`)
  }
  autoLines.push('')

  const file = path.join(DOCS_DIR, 'LIÇÕESAPRENDIDAS.MD')
  const existing = readText(file)
  const markerStart = '<!-- AUTO-LESSONS:START -->'
  const markerEnd = '<!-- AUTO-LESSONS:END -->'
  const autoBlock = [markerStart, ...autoLines, markerEnd, ''].join('\n')

  if (!existing) {
    return [
      '# LIÇÕES APRENDIDAS (NazcaTraker)',
      '',
      'Memória técnica do projeto. Entradas manuais nunca devem ser apagadas; a seção automática abaixo é mantida pelo self-heal.',
      '',
      '## Regras de uso',
      '',
      '- Nunca apagar registros históricos.',
      '- Sempre acrescentar novas entradas manuais quando houver bug recorrente, decisão arquitetural, padrão obrigatório ou correção que não pode regredir.',
      '- Ao trabalhar no projeto, consultar este arquivo antes de implementar mudanças sensíveis.',
      '',
      autoBlock,
    ].join('\n')
  }

  if (existing.includes(markerStart) && existing.includes(markerEnd)) {
    return existing.replace(new RegExp(`${markerStart}[\s\S]*?${markerEnd}`), autoBlock.trimEnd())
  }

  return `${existing.trimEnd()}\n\n${autoBlock}`
}

function renderReleaseChecklist(ctx) {
  const lines = []
  lines.push('# RELEASE CHECKLIST')
  lines.push('')
  lines.push('Checklist operacional para deploy do NazcaTraker. Atualizado automaticamente; complemente com detalhes do ambiente quando necessario.')
  lines.push('')
  lines.push('## Pré-deploy')
  lines.push('')
  lines.push('1. Fazer backup do banco SQLite (`DB_PATH`).')
  lines.push('2. Confirmar variáveis de ambiente do `.env` / `.env.example` e defaults seguros.')
  lines.push('3. Rodar `npm install` e validar dependências novas/removidas.')
  lines.push('4. Rodar `npm test`.')
  lines.push('5. Rodar `npm run context:check`.')
  lines.push('6. Revisar `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md` e `docs/LIÇÕESAPRENDIDAS.MD`.')
  lines.push('')
  lines.push('## Banco / SQLite')
  lines.push('')
  lines.push(`- Banco atual: SQLite (${ctx.db.tables.length} tabelas detectadas).`)
  lines.push('- Confirmar path de `DB_PATH`, permissão de escrita e espaço em disco.')
  lines.push('- Evitar operações destrutivas sem backup validado.')
  lines.push('')
  lines.push('## Rotas críticas para smoke test')
  lines.push('')
  const criticalRouteHints = [
    '/api/auth/login',
    '/api/auth/reset',
    '/api/users',
    '/api/viagens',
    '/api/relatorios',
    '/api/contratos-silo',
    '/api/talhoes',
    '/api/fretes',
    '/api/audit-logs',
  ]
  for (const p of criticalRouteHints) {
    const found = ctx.apiRoutes.some((r) => r.path.startsWith(p))
    lines.push(`- ${found ? '[x]' : '[ ]'} ${p}`)
  }
  lines.push('')
  lines.push('## Segurança')
  lines.push('')
  lines.push('- Confirmar autenticação, troca/reset de senha, permissões e cookies seguros.')
  lines.push('- Revisar uploads críticos (contratos, georreferenciamento, exportações) e limites de arquivo.')
  lines.push('- Garantir ausência de segredos hardcoded e revisão do `.env.example`.')
  lines.push('')
  lines.push('## Deploy')
  lines.push('')
  lines.push('1. Fazer pull da versão.')
  lines.push('2. Instalar dependências.')
  lines.push('3. Reiniciar o processo (`npm start`, PM2 ou serviço equivalente).')
  lines.push('4. Validar login e fluxo principal de colheita.')
  lines.push('5. Validar relatórios, exportações e uploads.')
  lines.push('6. Validar auditoria e mensagens de erro em modais/dialogs.')
  lines.push('')
  lines.push('## Status sugerido')
  lines.push('')
  lines.push('- `PRONTO PARA DEPLOY` quando checklist estiver verde e sem bloqueios críticos.')
  lines.push('- `ATENÇÃO NECESSÁRIA` quando houver pendências importantes mas controladas.')
  lines.push('- `DEPLOY NÃO RECOMENDADO` quando houver falha em testes, contexto ou rotas críticas.')
  lines.push('')
  return lines.join('\n')
}

function loadSnapshot() {
  const p = path.join(DOCS_DIR, '.context.snapshot.json')
  const txt = readText(p)
  if (!txt) return null
  try {
    return JSON.parse(txt)
  } catch {
    return null
  }
}

function saveSnapshot(snapshot) {
  const p = path.join(DOCS_DIR, '.context.snapshot.json')
  writeText(p, JSON.stringify(snapshot, null, 2) + '\n')
}

function buildCurrentContext() {
  const pkg = parsePackageJson(path.join(ROOT, 'package.json')) || {}
  const deps = pkg.dependencies || {}
  const envKeys = parseEnvExample(path.join(ROOT, '.env.example'))

  const appMiddleware = extractAppMiddleware(path.join(SRC_DIR, 'app.js'))

  const apiIndex = parseApiIndex(path.join(SRC_DIR, 'routes', 'api', 'index.js'))
  const apiRoutes = []
  const mountMeta = []
  if (apiIndex) {
    const fileByVar = Object.fromEntries(apiIndex.imports.map((x) => [x.varName, x.abs]))
    for (const m of apiIndex.mounts) {
      const file = fileByVar[m.varName]
      if (!file) continue
      mountMeta.push({ prefix: m.prefix, varName: m.varName, file: path.relative(ROOT, file).replaceAll('\\', '/') })
      const routes = extractRoutesFromRouterFile(file, { exportName: m.varName })
      for (const r of routes) {
        const full = normalizeJoinPath('/api', m.prefix, r.path)
        apiRoutes.push({ method: r.method, path: full })
      }
    }
    // health is defined in index.js; include explicitly
    apiRoutes.push({ method: 'GET', path: '/api/health' })
  }

  // Pages
  const pageRoutes = extractPageRoutes(path.join(SRC_DIR, 'routes', 'pages.js')).map((r) => ({
    method: r.method,
    path: r.path,
  }))

  // DB
  const db = extractDbTablesAndIndexes(path.join(SRC_DIR, 'db', 'migrate.js'))

  // ACL Modules: best-effort extraction from src/auth/acl.js
  const aclPath = path.join(SRC_DIR, 'auth', 'acl.js')
  const aclTxt = readText(aclPath) || ''
  const moduleValues = []
  for (const m of aclTxt.matchAll(/\b[A-Z0-9_]+:\s*['"]([^'"]+)['"]/g)) {
    // this also matches Actions; filter common
    const v = String(m[1])
    if (['view', 'create', 'update', 'delete'].includes(v)) continue
    moduleValues.push(v)
  }
  const aclModules = [...new Set(moduleValues)].sort((a, b) => a.localeCompare(b))

  // Human-facing modules list derived from mounted routers/pages.
  const moduleLines = []
  const prefixLabel = {
    '/': 'Contratos do silo: arquivos (upload/download/delete)',
    '/auth': 'Autenticacao (API /api/auth/*)',
    '/public': 'API publica (/api/public/*)',
    '/users': 'Usuarios (admin)',
    '/acl': 'Permissoes/ACL',
    '/audit-logs': 'Auditoria',
    '/safras': 'Safras',
    '/talhoes': 'Talhoes',
    '/destinos': 'Destinos',
    '/motoristas': 'Motoristas',
    '/tipos-plantio': 'Tipos de plantio',
    '/fretes': 'Fretes',
    '/destino-regras': 'Regras do destino',
    '/contratos-silo': 'Contratos do silo',
    '/talhao-safra': 'Area colhida (talhao x safra)',
    '/viagens': 'Colheita (viagens)',
    '/relatorios': 'Relatorios + export',
    '/quitacoes-motoristas': 'Quitacoes motoristas',
    '/participantes': 'Producao: participantes',
    '/politicas-custos': 'Producao: politicas de custos',
    '/talhao-acordos': 'Producao: acordos por talhao',
    '/vendas-sacas': 'Producao: vendas (sacas)',
    '/custos-lancamentos': 'Producao: custos manuais',
    '/apuracao': 'Producao: apuracao',
    '/notifications': 'Notificacoes (preferencias)',
    '/comunicacao': 'Comunicacao (webmail)',
  }
  for (const m of mountMeta.sort((a, b) => a.prefix.localeCompare(b.prefix))) {
    const label = prefixLabel[m.prefix] || `API: ${m.prefix}`
    moduleLines.push(`${label} (mount: /api${m.prefix}, router: ${m.file})`)
  }
  if (pageRoutes.some((r) => r.path.startsWith('/institucional'))) {
    moduleLines.push('Site institucional publico (/institucional/*)')
  }
  if (fs.existsSync(path.join(SRC_DIR, 'public', 'talhao.html'))) {
    moduleLines.push('Pagina publica de talhao (/talhao.html?id=... + /api/public/*)')
  }

  // Directory structure hints
  const dirStructure = [
    'src/',
    'src/routes/',
    'src/routes/api/',
    'src/middleware/',
    'src/services/',
    'src/repositories/',
    'src/db/',
    'src/public/',
    'docs/',
    'scripts/',
  ]

  const repos = (() => {
    const base = path.join(SRC_DIR, 'repositories')
    let files = []
    try {
      files = fs.readdirSync(base)
    } catch {
      files = []
    }
    return files
      .filter((f) => f.endsWith('.js'))
      .map((f) => `src/repositories/${f}`)
      .sort((a, b) => a.localeCompare(b))
  })()

  const services = (() => {
    const base = path.join(SRC_DIR, 'services')
    let files = []
    try {
      files = fs.readdirSync(base)
    } catch {
      files = []
    }
    return files
      .filter((f) => f.endsWith('.js'))
      .map((f) => `src/services/${f}`)
      .sort((a, b) => a.localeCompare(b))
  })()

  const middlewareFiles = (() => {
    const base = path.join(SRC_DIR, 'middleware')
    let files = []
    try {
      files = fs.readdirSync(base)
    } catch {
      files = []
    }
    return files
      .filter((f) => f.endsWith('.js'))
      .map((f) => `src/middleware/${f}`)
      .sort((a, b) => a.localeCompare(b))
  })()

  const scriptFiles = (() => {
    const base = path.join(ROOT, 'scripts')
    let files = []
    try {
      files = fs.readdirSync(base)
    } catch {
      return []
    }
    return files.filter((f) => f.endsWith('.js')).map((f) => path.join(base, f))
  })()

  const detectedIssues = detectLegacyScriptIssues({ tables: db.tables, scriptFiles })

  const migrateText = readText(path.join(SRC_DIR, 'db', 'migrate.js'))
  const viagemServiceText = readText(path.join(SRC_DIR, 'services', 'viagemService.js'))
  const validateText = readText(path.join(SRC_DIR, 'middleware', 'validate.js'))
  const errorHandlerText = readText(path.join(SRC_DIR, 'middleware', 'errorHandler.js'))

  const lessons = extractLessonsHeuristics({
    migrateText,
    viagemServiceText,
    validateText,
    errorHandlerText,
  })

  const workflows = [
    'Cadastros: safras/talhoes/destinos/motoristas/tipos-plantio',
    'Config: fretes por safra+motorista+destino; regras do destino; contratos por faixas',
    'Colheita: preview -> salvar; rateio por talhao (viagem_talhao); trava por contrato',
    'Relatorios: painel, resumo por talhao, entregas por destino, pagamento motoristas; export XLSX',
    'Quitacoes: pagamentos por periodo + resumo',
    'Producao: ledger em sacas (participantes/acordos/custos/vendas) + apuracao/reapurar',
  ]

  const criticalDeps = pickCriticalDeps(deps)

  // Deterministic signature of relevant facts
  const signaturePayload = {
    script: SCRIPT_ID,
    pkg: { name: pkg.name, version: pkg.version, dependencies: deps },
    envKeys,
    appMiddleware,
    apiRoutes: apiRoutes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)),
    pageRoutes: pageRoutes.sort((a, b) => a.path.localeCompare(b.path)),
    db,
    aclModules,
    repos,
    services,
    middlewareFiles,
    mountMeta,
    // Schema/validation fingerprints
    apiSchemasHash: sha256(readText(path.join(SRC_DIR, 'validation', 'apiSchemas.js')) || ''),
    migrateHash: sha256(readText(path.join(SRC_DIR, 'db', 'migrate.js')) || ''),
    apiIndexHash: sha256(readText(path.join(SRC_DIR, 'routes', 'api', 'index.js')) || ''),
  }

  const signature = sha256(JSON.stringify(signaturePayload))

  return {
    signature,
    signaturePayload,
    pkg,
    envKeys,
    appMiddleware,
    apiRoutes: apiRoutes
      .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)),
    pageRoutes,
    db,
    modules: moduleLines.length ? moduleLines : ['(nao foi possivel derivar modulos automaticamente)'],
    workflows,
    criticalDeps,
    repos,
    services,
    dirStructure,
    lessons,
    detectedIssues,
    runtime: {
      node: process.version,
      platform: process.platform,
    },
  }
}

function buildExpectedDocs(cur) {
  return {
    'PROJECT_CONTEXT.md': renderProjectContext(cur),
    'ARCHITECTURE.md': renderArchitecture(cur),
    'TASKS_OFICIAL.md': renderTasksOficial(cur),
    'CHANGELOG.md': renderChangelog(cur),
    // Lessons learned (requested filename uses unicode)
    'LIÇÕESAPRENDIDAS.MD': renderLicoesAprendidas(cur),
    'RELEASE_CHECKLIST.md': renderReleaseChecklist(cur),
  }
}

function getDocsMismatches(expectedDocs) {
  const mismatches = []
  for (const [name, expected] of Object.entries(expectedDocs)) {
    const p = path.join(DOCS_DIR, name)
    const actual = readText(p)
    if (actual === null) {
      mismatches.push({ file: name, reason: 'missing' })
      continue
    }
    if (actual !== expected) {
      mismatches.push({ file: name, reason: 'content_mismatch' })
    }
  }
  return mismatches
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('docs/ directory not found. Run from project root (colheita-web).')
    process.exit(2)
  }

  const cur = buildCurrentContext()
  const prev = loadSnapshot()
  const expectedDocs = buildExpectedDocs(cur)
  const mismatches = getDocsMismatches(expectedDocs)

  const docsOutOfDate = mismatches.length > 0
  const snapshotOutOfDate = !prev || prev.signature !== cur.signature

  if (MODE_CHECK) {
    if (docsOutOfDate) {
      const files = mismatches.map((m) => m.file).join(', ')
      console.error(`Context docs are out of date: ${files}. Run: node scripts/self-heal-context.js`)
      process.exit(1)
    }
    process.exit(0)
  }

  if (docsOutOfDate) {
    // Write official docs (always write deterministic outputs)
    for (const [name, content] of Object.entries(expectedDocs)) {
      writeText(path.join(DOCS_DIR, name), content)
    }
  }

  if (docsOutOfDate || snapshotOutOfDate) {
    const docsHashes = Object.fromEntries(Object.entries(expectedDocs).map(([name, content]) => [name, sha256(content)]))

    saveSnapshot({
      signature: cur.signature,
      generated_at: new Date().toISOString(),
      runtime: cur.runtime,
      payload: cur.signaturePayload,
      docs_hashes: docsHashes,
    })
  }

  if (docsOutOfDate) {
    process.stdout.write('Context docs updated.\n')
  } else if (snapshotOutOfDate) {
    process.stdout.write('Context snapshot updated.\n')
  } else {
    process.stdout.write('Context already up-to-date.\n')
  }
}

main()
