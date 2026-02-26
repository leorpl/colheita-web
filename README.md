# Colheita Web (Express + SQLite)

Aplicativo web/API baseado em `regras.md` para registrar viagens de colheita, calcular descontos (umidade/impureza/defeitos), sacas e frete, e gerar relatorios.

## Requisitos

- Node.js 18+ (testado com Node 24)

## Rodar

```bash
cd colheita-web
copy .env.example .env
npm install
npm run dev
```

Abra: `http://localhost:3000/`

Interface web inclusa (cadastros, viagens e relatorios).

O banco SQLite e criado em `./data/app.db`.

## Fluxo recomendado

1) Cadastrar `safras`
2) Cadastrar `talhoes`
3) Cadastrar `destinos` (opcional: `trava_sacas`)
4) Cadastrar `motoristas`
5) Cadastrar `fretes` (motorista x destino)
6) Lancar `viagens`

## Endpoints

- `GET /api/health`
- CRUD:
  - `GET/POST /api/safras`
  - `GET/POST /api/talhoes`
  - `GET/POST /api/destinos`
  - `GET/POST /api/motoristas`
  - `GET/POST /api/fretes` (upsert)
  - `GET/POST /api/viagens` (lista retorna `{ items, totals }`)
- Relatorios:
  - `GET /api/relatorios/colheita` (mesmos filtros de `/api/viagens`)
  - `GET /api/relatorios/resumo-talhao?safra_id=1`
  - `GET /api/relatorios/pagamento-motoristas?de=YYYY-MM-DD&ate=YYYY-MM-DD`
  - `GET /api/relatorios/entregas-por-destino?safra_id=1`

## Notas de regra

- Umidade-base configuravel em `.env` via `UMIDADE_BASE` (default 0.13).
- Percentuais aceitam formato `0..1` ou `0..100` (o backend normaliza).
- `sub_total_frete` usa `peso_bruto_kg/60` (sacas de frete) x `valor_por_saca`.
- Trava por destino (`destino.trava_sacas`) e validada no backend na criacao/edicao de viagens.
