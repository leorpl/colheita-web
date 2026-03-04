# Architecture (NazcaTraker)

## 1) Visao geral
- Aplicacao web unica em `colheita-web/`.
- Backend: Express (API + paginas) e calculos no servidor.
- Frontend: SPA simples (JS puro) servida como arquivos estaticos.
- Persistencia: SQLite local via `better-sqlite3`.

## 2) Componentes e camadas (codigo real)
- HTTP server: `colheita-web/src/server.js` (inicia, roda migrations e faz listen).
- Express app: `colheita-web/src/app.js`
  - middlewares: request id, logging, helmet (CSP), compression, cors, json parser, static.
  - routers: paginas (`/`, `/login`) e API (`/api/*`).
- Rotas API: `colheita-web/src/routes/api/*.js`
  - validacao: Zod via `colheita-web/src/middleware/validate.js`
  - auth/perms: `colheita-web/src/middleware/auth.js` + `colheita-web/src/auth/permissions.js`
- Services (regras de negocio): `colheita-web/src/services/*.js`
  - calculo e validacoes de colheita: `colheita-web/src/services/viagemService.js`
  - relatorios: `colheita-web/src/services/relatoriosService.js`
  - quitacoes: `colheita-web/src/services/quitacaoMotoristasService.js`
- Repositories (SQL): `colheita-web/src/repositories/*.js`
- Dominio/calculos: `colheita-web/src/domain/calculations.js` + normalizacao `colheita-web/src/domain/normalize.js`

## 3) Banco de dados
- Engine: SQLite.
- Driver: `better-sqlite3` (sincrono).
- Arquivo: `DB_PATH` (default `./data/app.db`).
- Migrations: `colheita-web/src/db/migrate.js` (cria tabelas e faz alteracoes incrementais em runtime).
- Pragmas: WAL + `foreign_keys=ON` (`colheita-web/src/db/db.js`).

### 3.1 Tabelas principais (schema atual)
- `plantio_tipo` (tipos de plantio)
- `safra`
- `talhao`
- `destino`
- `motorista`
- `frete` (UNIQUE safra_id+motorista_id+destino_id)
- `destino_regra_plantio` (regras por safra+destino+tipo_plantio)
- `umidade_faixa_plantio` (faixas de umidade/desc + custo de secagem por saca)
- `contrato_silo` (cabecalho do contrato por safra+destino+tipo_plantio)
- `contrato_silo_faixa` (faixas do contrato: sacas + preco travado)
- `talhao_safra` (% area colhida por talhao na safra)
- `viagem` (lancamentos + campos calculados e custos)
- `viagem_talhao` (rateio de uma viagem em multiplos talhoes)
- `motorista_quitacao` (pagamentos por periodo)
- `usuario` e `usuario_sessao` (auth por cookie)

### 3.2 Tabelas legadas ainda presentes
- `destino_regra` e `umidade_faixa` existem no schema e em alguns scripts, mas o fluxo principal do calculo usa `*_plantio`.

## 4) Fluxos principais (request -> resposta)

### 4.1 UI (SPA)
- Arquivos: `colheita-web/src/public/index.html`, `colheita-web/src/public/app.js`, `colheita-web/src/public/app.css`.
- Navegacao por hash (ex: `#/painel`, `#/colheita`).
- Consome API via `fetch('/api/...')`.

### 4.2 Autenticacao
- Login: `POST /api/auth/login` cria sessao em `usuario_sessao` e seta cookie `SESSION_COOKIE_NAME`.
- Guard: `authGate` em `colheita-web/src/middleware/auth.js` protege `/api/*` exceto `/api/health`, `/api/public/*` e `/api/auth/*`.
- Autorizacao: `requirePerm(Permissions.*)` aplicado por rota.
- Feature flag: `AUTH_ENABLED` desabilita o gate e as checagens de permissao.

### 4.3 Lancamento/preview de colheita (viagem)
- Preview: `POST /api/viagens/preview`
  - valida body (Zod) -> `viagemService.buildPayload()` -> calcula descontos/sacas/frete/custos -> devolve payload calculado + status de trava.
- Criacao: `POST /api/viagens`
  - reusa `buildPayload()` -> valida unicidade (safra,ficha) -> grava em `viagem`.
- Edicao: `PUT /api/viagens/:id` idem, com exclusao do proprio id no acumulado.

### 4.4 Regras do destino (safra+destino+tipo_plantio)
- Upsert: `POST /api/destino-regras` grava em `destino_regra_plantio` e substitui faixas de umidade (`umidade_faixa_plantio`).
- Contratos (travas/preco travado): `POST /api/contratos-silo` grava em `contrato_silo` e substitui `contrato_silo_faixa`.
- Get one: `GET /api/destino-regras/one?safra_id=..&destino_id=..&tipo_plantio=..`.
- List: `GET /api/destino-regras/plantio`.

### 4.5 Relatorios
- Painel: `GET /api/relatorios/painel` (totais gerais e por safra atual/painel, perdas, umidade media ponderada, areas).
- Resumo por talhao: `GET /api/relatorios/resumo-talhao?safra_id=..`.
- Entregas por destino: `GET /api/relatorios/entregas-por-destino?safra_id=..[&tipo_plantio=..]`.
- Pagamento motoristas: `GET /api/relatorios/pagamento-motoristas?[de=..&ate=..]`.

### 4.6 Quitacoes
- Resumo (saldo): `GET /api/quitacoes-motoristas/resumo?de=YYYY-MM-DD&ate=YYYY-MM-DD`.
- CRUD: `POST/PUT/DELETE /api/quitacoes-motoristas`.

### 4.7 Usuarios (admin)
- CRUD: `GET/POST/PUT/DELETE /api/users`.
- Troca de senha: `PUT /api/users/:id/password`.

## 5) Regras de calculo (pontos tecnicos)
- Normalizacao de percentuais: entrada 0..100 (max 2 casas) -> fracao 0..1 (`normalizePercent100`).
- Peso bruto: `carga_total_kg - tara_kg`.
- Descontos de qualidade: `max(0, pct - limite) * peso_bruto_kg`.
- Umidade:
  - desconto vem da tabela de faixas por destino_regra_plantio (se nao encontrar faixa, desconto = 0).
  - pode haver override manual (`umidade_desc_pct_manual`).
  - aplicado APOS descontos de qualidade (base = peso_bruto - descontos_sem_umidade).
- Sacas: `peso_limpo_seco_kg / 60`.
- Frete: base em sacas de frete (`peso_bruto_kg/60`) * `frete.valor_por_saca`.
- Custos adicionais:
  - secagem: `sacas (limpa/seca) * custo_secagem_por_saca` (vem da faixa de umidade).
  - custo silo / terceiros: por saca limpa/seca (vem da regra).
 - Compra no silo: preco vem do contrato (`contrato_silo_faixa`) abatendo faixas em ordem; se exceder o total contratado, o backend bloqueia o salvamento do lancamento.
 - Trava (limite de entrega): compara soma de `viagem.sacas` (por safra+destino+tipo_plantio) com a soma de sacas do contrato.

## 6) Observabilidade e erros
- Logger: Pino (`colheita-web/src/logger.js`) + `pino-http`.
- `x-request-id` gerado em `colheita-web/src/middleware/requestId.js`.
- Erros:
  - `AppError` com status/.details (422/409/401/403/404).
  - ZodError vira 422.

## 7) Middlewares de seguranca e rede
- Helmet CSP: libera `img-src` com `https:` e `data:` e permite `frame-src` Google Maps (para embed em pagina publica do talhao).
- CORS: `CORS_ORIGIN` (string com lista separada por virgula) vira allowlist no backend.

## 7) Scripts
- Import/seed (podem ser usados em ambiente local): `colheita-web/scripts/*`.
- Observacao: ha scripts que usam tabelas/colunas legadas (ex: `destino.trava_sacas`, `destino_regra`, `umidade_faixa`).

## 8) Deploy
- Design atual e orientado a uso local (SQLite em arquivo).
- Para produzir ambiente remoto, seria necessario definir estrategia de persistencia (volume) e revisar seeds de usuario/senhas em `migrate()`.
