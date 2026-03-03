# Project Context (NazcaTraker)

## 1) Produto
- Nome (UI): NazcaTraker
- App: `colheita-web/` (Node.js + Express + SQLite + SPA em JS puro)
- Objetivo: controlar colheita por viagem (ficha), com calculos automaticos (peso, descontos, sacas, frete, custos) e relatorios.

## 2) Problema que resolve
- Centraliza lancamentos de viagens de colheita e padroniza calculos (umidade, impurezas/defeitos, sacas, frete).
- Consolida resultados (por safra, talhao, destino, motorista) e gera indicadores (produtividade, perdas, entregas).

## 3) Usuarios e permissoes (modelo real)
- Autenticacao por cookie (sessao em SQLite), controlada por `AUTH_ENABLED`.
- Roles: `admin`, `gestor`, `operador`, `leitura`, `motorista`.
- Autorizacao por permissao (exemplos): `colheita:read/write`, `config:read/write`, `cadastros:read/write`, `relatorios:read`, `users:manage`, `quitacoes:write`.

## 4) Escopo
- Inclui:
  - Cadastros: safras, talhoes, destinos, motoristas, tipos de plantio.
  - Fretes por (safra, motorista, destino).
  - Regras do destino por (safra, destino, tipo_plantio): limites, trava, faixas de umidade/desc, custos e faixas de compra.
  - Colheita (viagens): preview, criacao/edicao/exclusao, recalculo de compra por faixas, comparacao de destinos.
  - Relatorios: painel, resumo por talhao, entregas por destino, pagamento por motorista.
  - Quitacoes de motoristas (pagamentos) e resumo de saldo.
  - Pagina publica de talhao (consulta resumida) via `/api/public/*`.
- Nao inclui (no codigo atual):
  - Integracao com balanca/silo/ERP.
  - Multi-tenant, multi-fazenda, multi-banco.
  - App mobile nativo.

## 5) Dados e persistencia
- Banco: SQLite local (arquivo configurado em `DB_PATH`, default `colheita-web/data/app.db`).
- Migrations: em runtime, `colheita-web/src/db/migrate.js` cria/ajusta schema.

## 6) Fluxos principais (visao do usuario)
- Login -> abrir painel -> cadastrar base (safra/talhao/destino/motorista/frete/regras) -> lancar colheita -> acompanhar relatorios.
- Preview de colheita calcula automaticamente antes de salvar e sinaliza trava (limite de entrega).
- Comparar destinos simula quanto sobra (compra - custos - frete) para a mesma carga.

## 7) Como rodar (local)
- `cd colheita-web`
- `copy .env.example .env`
- `npm install`
- `npm run dev`
- Abrir: `http://localhost:3000/`

## 8) Limitacoes/observacoes importantes (estado atual do codigo)
- Regras usadas no calculo sao obrigatoriamente por (safra, destino, tipo_plantio); sem regra, a viagem nao salva.
- Percentuais sao entrada 0..100 (max 2 casas) e normalizados internamente para 0..1.
- Ha tabelas/scripts legados (ex: `destino_regra` e `umidade_faixa`) mantidos no schema, mas nao sao o caminho principal do calculo atual.
