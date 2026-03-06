# Validacao e Regras de Negocio

Fontes principais:
- Schemas Zod: `src/validation/apiSchemas.js`
- Middleware: `src/middleware/validate.js`
- Regras/servicos: `src/services/*.js` e regras adicionais nas rotas `src/routes/api/*.js`

## Como a validacao funciona

- `validateBody(schema)`: garante `req.body` como objeto e roda `schema.parse()`.
- `validateQuery(schema)`: normaliza query repetida (string[]) para 1 valor e roda `schema.parse()`; em seguida tenta sobrescrever `req.query` com o parsed.
- `validateParams(schema)`: roda `schema.parse(req.params)`.

Quando a validacao falha, `ZodError` e convertido para 400 em `src/middleware/errorHandler.js`, com `details` (path/message).

## Schemas (Zod) por area

Auth (`AuthSchemas`)

- `LoginBody`: `username` (1..64), `password` (1..256)
- `ForgotBody`: `email` (1..64; aceito como string simples; resolucao real tenta email ou username)
- `ResetBody`: `token` (16..256), `password` (min 8)

Cadastros

- Safra (`SafraSchemas.Body`): `safra` obrigatoria; `data_referencia` aceita `YYYY-MM-DD` ou `DD/MM/YYYY` e normaliza
- Talhao (`TalhaoSchemas.Body`): URLs validadas (`foto_url`, `maps_url`); textos opcionais viram `null`
- Destino (`DestinoSchemas.Body`): `distancia_km` pode ser `null`; `maps_url` e URL valida
- Motorista (`MotoristaSchemas.Body`): `cpf` aceita apenas caracteres `[0-9.\-\s]` (nao valida digito)
- Tipos de plantio (`TiposPlantioSchemas.Body`): `nome` curto

Fretes (`FreteSchemas`)

- `UpsertBody`: chave (safra/motorista/destino) + `valor_por_saca`
- `CopySafraBody`: `from_safra_id`/`to_safra_id`
- `BulkUpsertBody`: `items` max 10k

Viagens/colheita (`ViagemSchemas`)

- `ficha`: aceita string numerica (ate 12) ou numero (int)
- Rateio (`talhoes[]`): cada item exige `pct_rateio` OU `kg_rateio`; bloqueia talhao repetido
- Campos de data/hora: valida `YYYY-MM-DD` e `HH:MM`; se informar hora de entrega exige data de entrega
- Sanity: `tara_kg` nao pode ser maior que `carga_total_kg`
- Custos em sacas: `custo_*_sacas` opcionais, coerced para numero

Usuarios (`UsersSchemas`)

- Create: exige `email` (e valida formato) e `password` (min 8)
- Update: exige `email` para usuarios ativos; `menus` limitado aos valores de `Menus`

Regras de destino (`DestinoRegrasSchemas`)

- `UpsertBody`: chave (safra/destino/tipo_plantio) + limites/custos + `umidade_faixas[]` (max 500)
- `DeletePlantioQuery`: `force=1` para excluir mesmo em uso

Producao/divisao (`ProducaoSchemas`)

- `ParticipanteBody`: `tipo` restrito a lista; `active` boolean
- `PoliticaCustosBody`: `regras[]` com `modo_rateio`/`momento` restritos
- `TalhaoAcordoBody`: soma de `percentual_producao` deve ser 100%
- `VendaSacaBody`: exige `destino_id` quando comprador e `destino`; exige `terceiro_nome` quando comprador e `terceiro`
- `CustoLancamentoBody`: exige informar `valor_rs` OU `valor_sacas`

## Regras de negocio (alem do Zod)

Regras nas rotas

- `src/routes/api/destinoRegras.js`: bloqueia update/upsert de regra (plantio) se ja foi usada em `viagem` (retorna 409), para evitar recalculo retroativo.
- `src/routes/api/destinoRegras.js`: delete de regra (plantio) exige `force=1` quando ja existe colheita vinculada.
- `src/routes/api/viagens.js`: perfil `motorista` so pode ver/preview/comparar viagens do seu `motorista_id` e so pode atualizar campos operacionais (`PUT /:id/motorista`).

Regras em services

- `src/services/viagemService.js`:
  - `create()`/`update()` exigem `data_saida` e `hora_saida`.
  - `buildPayload()` materializa campos calculados e aplica regra do destino + contrato.
  - Contrato: compra por faixas so e calculada quando a entrega fica dentro do total contratado; se exceder, `valor_compra_*` fica `null`.
  - `getTravaStatus()` calcula status (ok/proximo/atingido/ultrapassado) por safra+destino+tipo_plantio.
- `src/services/producaoService.js`: sincroniza ledger (`participante_sacas_mov`) a partir de eventos (colheita, vendas, custos) e suporta reapurar uma safra.
