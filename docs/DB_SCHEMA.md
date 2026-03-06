# DB Schema (SQLite)

Fonte: `src/db/migrate.js` (schema/migrations em runtime).

## Convencoes

- Datas/horas: armazenadas como TEXT (formato ISO/SQLite `datetime('now')`).
- Auditoria de criacao/alteracao: varios recursos possuem `created_at`/`updated_at` e, quando disponivel, `created_by_user_id`/`updated_by_user_id`.
- Soft delete: em tabelas selecionadas existe `deleted_at`/`deleted_by_user_id`.
- FKs: `PRAGMA foreign_keys=ON` e usado em runtime.

## Tabelas

Cadastros

- `plantio_tipo`
  - Campos: `id`, `nome` (UNIQUE), `created_at`, `updated_at`
- `safra`
  - Campos: `id`, `safra` (UNIQUE), `plantio`, `data_referencia`, `area_ha`, `painel`, `created_at`, `updated_at`
- `talhao`
  - Campos: `id`, `codigo` (UNIQUE), `local`, `nome`, `situacao`, `hectares`, `posse`, `contrato`, `observacoes`
  - Campos incrementais: `irrigacao`, `foto_url`, `maps_url`, `tipo_solo`, `calagem`, `gessagem`, `fosforo_corretivo`
- `destino`
  - Campos: `id`, `codigo` (UNIQUE), `local`, `maps_url`, `distancia_km`, `observacoes`
- `motorista`
  - Campos: `id`, `nome` (UNIQUE), `placa`, `cpf`, `banco`, `pix_conta`, `tipo_veiculo`, `capacidade_kg`

Frete

- `frete`
  - Campos: `id`, `safra_id`, `motorista_id`, `destino_id`, `valor_por_saca`
  - Constraint: UNIQUE (`safra_id`, `motorista_id`, `destino_id`)
  - FKs: safra/motorista/destino (ON DELETE CASCADE)

Regras e contratos

- `destino_regra` (legado)
  - Campos: `id`, `safra_id`, `destino_id`, `trava_sacas`, limites de qualidade, `custo_silo_por_saca`, `custo_terceiros_por_saca`
  - Constraint: UNIQUE (`safra_id`, `destino_id`)
- `umidade_faixa` (legado)
  - Campos: `id`, `destino_regra_id`, `umid_gt`, `umid_lte`, `desconto_pct`, `custo_secagem_por_saca`
  - FK: `destino_regra_id` (ON DELETE CASCADE)
- `destino_regra_plantio` (atual)
  - Campos: `id`, `safra_id`, `destino_id`, `tipo_plantio`, `trava_sacas`, limites de qualidade, custos
  - Campo: `valor_compra_por_saca` (mantido por compat, mas precificacao efetiva usa contrato)
  - Constraint: UNIQUE (`safra_id`, `destino_id`, `tipo_plantio`)
- `umidade_faixa_plantio`
  - Campos: `id`, `destino_regra_plantio_id`, `umid_gt`, `umid_lte`, `desconto_pct`, `custo_secagem_por_saca`
  - FK: `destino_regra_plantio_id` (ON DELETE CASCADE)
- `contrato_silo`
  - Campos: `id`, `safra_id`, `destino_id`, `tipo_plantio`, `sacas_contratadas`, `preco_travado_por_saca`, `observacoes`
  - Constraint: UNIQUE (`safra_id`, `destino_id`, `tipo_plantio`)
- `contrato_silo_faixa`
  - Campos: `id`, `contrato_silo_id`, `ordem`, `sacas`, `preco_por_saca`
  - Constraint: UNIQUE (`contrato_silo_id`, `ordem`)
- `contrato_silo_arquivo`
  - Campos: `id`, `contrato_silo_id`, `file_name`, `storage_key`, `mime_type`, `file_size`

Colheita

- `viagem`
  - Identidade: UNIQUE (`safra_id`, `ficha`)
  - FKs (RESTRICT): `safra_id`, `talhao_id`, `destino_id`, `motorista_id`
  - Entrada: datas/horas, pesos (`carga_total_kg`, `tara_kg`), percentuais (umidade/qualidade)
  - Materializado (calculo): `peso_bruto_kg`, descontos em kg, `peso_limpo_seco_kg`, `sacas`, frete e custos
  - Contrato/compra: `valor_compra_*` + `valor_compra_detalhe_json`
  - Custos em sacas (controle fisico): `custo_*_sacas`
- `viagem_talhao`
  - Campos: `id`, `viagem_id`, `talhao_id`, `pct_rateio`, `kg_rateio`
  - Constraint: UNIQUE (`viagem_id`, `talhao_id`)
  - FK: `viagem_id` (CASCADE)
- `talhao_safra`
  - Campos: `id`, `safra_id`, `talhao_id`, `pct_area_colhida`
  - Constraint: UNIQUE (`safra_id`, `talhao_id`)

Quitacoes

- `motorista_quitacao`
  - Campos: `id`, `motorista_id`, `de`, `ate`, `data_pagamento`, `valor`, `forma_pagamento`, `observacoes`
  - FK: `motorista_id` (CASCADE)

Usuarios, sessao e ACL

- `usuario`
  - Campos: `id`, `username` (UNIQUE), `email` (indice UNIQUE por LOWER(email)), `nome`, `role`, `motorista_id`, `menus_json`, `active`
  - Campos de senha: `password_hash`, `password_salt`
- `usuario_sessao`
  - Campos: `id`, `usuario_id`, `token_hash` (UNIQUE), `expires_at`
- `role`
  - Campos: `id`, `name` (UNIQUE)
- `role_permission`
  - PK: (`role_id`, `module`)
  - Campos: `can_view`, `can_create`, `can_update`, `can_delete`
- `user_permission`
  - PK: (`user_id`, `module`)
  - Campos: `can_view`, `can_create`, `can_update`, `can_delete` (NULL = herdar)
- `password_reset_token`
  - Campos: `id`, `user_id`, `token_hash` (UNIQUE), `expires_at`, `used_at`

Auditoria e notificacoes

- `audit_log`
  - Campos: `module_name`, `record_id`, `action_type`, ator (`changed_by_user_id` + snapshots), IP/UA, jsons (`old_values_json`, `new_values_json`, `changed_fields_json`)
- `user_notification_preferences`
  - Campos: `user_id`, `module`, flags `notify_*`, `delivery_mode`
  - Constraint: UNIQUE (`user_id`, `module`)
- `email_notification_sent`
  - Campos: `user_id`, `audit_log_id`, `status`, `error`
  - Constraint: UNIQUE (`user_id`, `audit_log_id`)

Producao/divisao (ledger em sacas)

- `participante`
  - Campos: `id`, `nome`, `tipo`, `documento`, `active` + soft delete
- `politica_custos` e `politica_custos_regra`
  - `politica_custos_regra`: UNIQUE (`politica_custos_id`, `custo_tipo`)
- `talhao_acordo` e `talhao_acordo_participante`
  - `talhao_acordo`: UNIQUE (`talhao_id`, `safra_id`, `tipo_plantio`)
  - `talhao_acordo_participante`: UNIQUE (`talhao_acordo_id`, `participante_id`)
- `venda_saca`
- `custo_lancamento`
- `participante_sacas_mov`
  - Campos: `safra_id`, `participante_id`, `talhao_id`, `destino_id`, `mov_tipo`, `origem_tipo`/`origem_id`, `custo_tipo`, `sacas_credito`/`sacas_debito`, `valor_rs`, flags de pendencia

## Indices (principais)

- `viagem`: por `safra_id`, `destino_id`, `talhao_id`, `motorista_id`, `data_saida`
- `viagem_talhao`: por `viagem_id`, `talhao_id`
- `motorista_quitacao`: por `motorista_id`, periodo (`de`,`ate`), `data_pagamento`
- `usuario_sessao`: por `usuario_id`, `expires_at`
- `audit_log`: por `created_at`, `changed_by_user_id`, `module_name`, (`module_name`,`record_id`), `action_type`
- `contrato_silo`: por (`safra_id`,`destino_id`,`tipo_plantio`)
- `contrato_silo_faixa`: por `contrato_silo_id`
- Producao: indices por `deleted_at`/FKs e chaves de consulta (`safra_id`, `participante_id`, `talhao_id`, `destino_id`, `origem_tipo`/`origem_id`)
