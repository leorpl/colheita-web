import { db } from './db.js'
import { hashPassword } from '../auth/password.js'
import { env } from '../config/env.js'
import { logger } from '../logger.js'
import { permsForRole, Roles, Permissions } from '../auth/permissions.js'

function hasColumn(table, column) {
  // Defesa: evita identifiers inesperados (nao pode ser parametrizado).
  const t = String(table || '')
  if (!/^[a-z_][a-z0-9_]*$/i.test(t)) {
    throw new Error('Invalid table name')
  }
  const cols = db.prepare(`PRAGMA table_info(${t})`).all()
  return cols.some((c) => c.name === column)
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plantio_tipo (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS safra (
      id INTEGER PRIMARY KEY,
      safra TEXT NOT NULL UNIQUE,
      plantio TEXT,
      data_referencia TEXT,
      area_ha REAL NOT NULL DEFAULT 0,
      painel INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS talhao (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      local TEXT,
      nome TEXT,
      situacao TEXT,
      hectares REAL NOT NULL DEFAULT 0,
      posse TEXT,
      contrato TEXT,
      observacoes TEXT,
      geometry_geojson TEXT,
      geometry_props_json TEXT,
      geometry_source_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS destino (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      local TEXT NOT NULL,
      maps_url TEXT,
      distancia_km REAL,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS motorista (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      placa TEXT,
      cpf TEXT,
      banco TEXT,
      pix_conta TEXT,
      tipo_veiculo TEXT,
      capacidade_kg REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS frete (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      motorista_id INTEGER NOT NULL,
      destino_id INTEGER NOT NULL,
      valor_por_saca REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (safra_id, motorista_id, destino_id),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
      FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE CASCADE,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS destino_regra (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      destino_id INTEGER NOT NULL,
      trava_sacas REAL,

      custo_silo_por_saca REAL NOT NULL DEFAULT 0,
      custo_terceiros_por_saca REAL NOT NULL DEFAULT 0,

      impureza_limite_pct REAL NOT NULL DEFAULT 0,
      ardidos_limite_pct REAL NOT NULL DEFAULT 0,
      queimados_limite_pct REAL NOT NULL DEFAULT 0,
      avariados_limite_pct REAL NOT NULL DEFAULT 0,
      esverdiados_limite_pct REAL NOT NULL DEFAULT 0,
      quebrados_limite_pct REAL NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,

      UNIQUE (safra_id, destino_id),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE CASCADE
    );

    -- Regras por destino + safra + tipo_plantio (ex: SOJA/MILHO)
    CREATE TABLE IF NOT EXISTS destino_regra_plantio (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      destino_id INTEGER NOT NULL,
      tipo_plantio TEXT NOT NULL,
      trava_sacas REAL,

      valor_compra_por_saca REAL NOT NULL DEFAULT 120,

      custo_silo_por_saca REAL NOT NULL DEFAULT 0,
      custo_terceiros_por_saca REAL NOT NULL DEFAULT 0,

      impureza_limite_pct REAL NOT NULL DEFAULT 0,
      ardidos_limite_pct REAL NOT NULL DEFAULT 0,
      queimados_limite_pct REAL NOT NULL DEFAULT 0,
      avariados_limite_pct REAL NOT NULL DEFAULT 0,
      esverdiados_limite_pct REAL NOT NULL DEFAULT 0,
      quebrados_limite_pct REAL NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,

      UNIQUE (safra_id, destino_id, tipo_plantio),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS umidade_faixa_plantio (
      id INTEGER PRIMARY KEY,
      destino_regra_plantio_id INTEGER NOT NULL,
      umid_gt REAL NOT NULL,
      umid_lte REAL NOT NULL,
      desconto_pct REAL NOT NULL,
      custo_secagem_por_saca REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (destino_regra_plantio_id) REFERENCES destino_regra_plantio(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS umidade_faixa (
      id INTEGER PRIMARY KEY,
      destino_regra_id INTEGER NOT NULL,
      umid_gt REAL NOT NULL,
      umid_lte REAL NOT NULL,
      desconto_pct REAL NOT NULL,
      custo_secagem_por_saca REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (destino_regra_id) REFERENCES destino_regra(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS talhao_safra (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      talhao_id INTEGER NOT NULL,
      pct_area_colhida REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (safra_id, talhao_id),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS viagem (
      id INTEGER PRIMARY KEY,
      ficha TEXT NOT NULL,
      safra_id INTEGER NOT NULL,
      tipo_plantio TEXT,
      talhao_id INTEGER NOT NULL,
      local TEXT,
      destino_id INTEGER NOT NULL,
      motorista_id INTEGER NOT NULL,
      placa TEXT,
      data_saida TEXT,
      hora_saida TEXT,
      data_entrega TEXT,
      hora_entrega TEXT,

      carga_total_kg REAL NOT NULL,
      tara_kg REAL NOT NULL,

      umidade_pct REAL NOT NULL DEFAULT 0,

      impureza_pct REAL NOT NULL DEFAULT 0,
      ardidos_pct REAL NOT NULL DEFAULT 0,
      queimados_pct REAL NOT NULL DEFAULT 0,
      avariados_pct REAL NOT NULL DEFAULT 0,
      esverdiados_pct REAL NOT NULL DEFAULT 0,
      quebrados_pct REAL NOT NULL DEFAULT 0,

      impureza_limite_pct REAL NOT NULL DEFAULT 0,
      ardidos_limite_pct REAL NOT NULL DEFAULT 0,
      queimados_limite_pct REAL NOT NULL DEFAULT 0,
      avariados_limite_pct REAL NOT NULL DEFAULT 0,
      esverdiados_limite_pct REAL NOT NULL DEFAULT 0,
      quebrados_limite_pct REAL NOT NULL DEFAULT 0,

      peso_bruto_kg REAL NOT NULL,
      umidade_desc_pct REAL NOT NULL,
      umidade_desc_pct_manual REAL,
      umidade_kg REAL NOT NULL,
      impureza_kg REAL NOT NULL,
      ardidos_kg REAL NOT NULL,
      queimados_kg REAL NOT NULL,
      avariados_kg REAL NOT NULL,
      esverdiados_kg REAL NOT NULL,
      quebrados_kg REAL NOT NULL,
      peso_limpo_seco_kg REAL NOT NULL,
      sacas REAL NOT NULL,

      sacas_frete REAL NOT NULL,
      frete_tabela REAL NOT NULL,
      sub_total_frete REAL NOT NULL,

      -- Custos em sacas (controle fisico; opcional)
      custo_frete_sacas REAL NOT NULL DEFAULT 0,
      custo_secagem_sacas REAL NOT NULL DEFAULT 0,
      custo_silo_sacas REAL NOT NULL DEFAULT 0,
      custo_terceiros_sacas REAL NOT NULL DEFAULT 0,
      custo_outros_sacas REAL NOT NULL DEFAULT 0,

      secagem_custo_por_saca REAL NOT NULL DEFAULT 0,
      sub_total_secagem REAL NOT NULL DEFAULT 0,

      valor_compra_por_saca_aplicado REAL,
      valor_compra_total REAL,
      valor_compra_detalhe_json TEXT,
      valor_compra_entrega_antes REAL,
      valor_compra_entrega_depois REAL,

      custo_silo_por_saca REAL NOT NULL DEFAULT 0,
      sub_total_custo_silo REAL NOT NULL DEFAULT 0,
      abatimento_total_silo REAL NOT NULL DEFAULT 0,
      abatimento_por_saca_silo REAL NOT NULL DEFAULT 0,

      custo_terceiros_por_saca REAL NOT NULL DEFAULT 0,
      sub_total_custo_terceiros REAL NOT NULL DEFAULT 0,
      abatimento_total_terceiros REAL NOT NULL DEFAULT 0,
      abatimento_por_saca_terceiros REAL NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,

      UNIQUE (safra_id, ficha),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE RESTRICT,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE RESTRICT,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE RESTRICT,
      FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_viagem_safra ON viagem(safra_id);
    CREATE INDEX IF NOT EXISTS idx_viagem_destino ON viagem(destino_id);
    CREATE INDEX IF NOT EXISTS idx_viagem_talhao ON viagem(talhao_id);
    CREATE INDEX IF NOT EXISTS idx_viagem_motorista ON viagem(motorista_id);
    CREATE INDEX IF NOT EXISTS idx_viagem_data_saida ON viagem(data_saida);

    -- rateio de uma viagem por talhao (para cargas mistas)
    CREATE TABLE IF NOT EXISTS viagem_talhao (
      id INTEGER PRIMARY KEY,
      viagem_id INTEGER NOT NULL,
      talhao_id INTEGER NOT NULL,
      -- fracao 0..1 (quando informado via % no cadastro)
      pct_rateio REAL,
      -- kg rateado (quando peso bruto existir ou quando informado em kg)
      kg_rateio REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (viagem_id, talhao_id),
      FOREIGN KEY (viagem_id) REFERENCES viagem(id) ON DELETE CASCADE,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_viagem_talhao_viagem ON viagem_talhao(viagem_id);
    CREATE INDEX IF NOT EXISTS idx_viagem_talhao_talhao ON viagem_talhao(talhao_id);

    CREATE TABLE IF NOT EXISTS motorista_quitacao (
      id INTEGER PRIMARY KEY,
      motorista_id INTEGER NOT NULL,
      de TEXT NOT NULL,
      ate TEXT NOT NULL,
      data_pagamento TEXT NOT NULL,
      valor REAL NOT NULL,
      forma_pagamento TEXT,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quitacao_motorista ON motorista_quitacao(motorista_id);
    CREATE INDEX IF NOT EXISTS idx_quitacao_periodo ON motorista_quitacao(de, ate);
    CREATE INDEX IF NOT EXISTS idx_quitacao_data_pagamento ON motorista_quitacao(data_pagamento);

    CREATE TABLE IF NOT EXISTS usuario (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      nome TEXT,
      role TEXT NOT NULL,
      motorista_id INTEGER,
      menus_json TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS usuario_sessao (
      id INTEGER PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS role_permission (
      role_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 0,
      can_create INTEGER NOT NULL DEFAULT 0,
      can_update INTEGER NOT NULL DEFAULT 0,
      can_delete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      PRIMARY KEY (role_id, module),
      FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_permission (
      user_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      can_view INTEGER,
      can_create INTEGER,
      can_update INTEGER,
      can_delete INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      PRIMARY KEY (user_id, module),
      FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_token (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY,
      module_name TEXT NOT NULL,
      record_id INTEGER,
      action_type TEXT NOT NULL,
      changed_by_user_id INTEGER,
      changed_by_name_snapshot TEXT,
      ip_address TEXT,
      user_agent TEXT,
      old_values_json TEXT,
      new_values_json TEXT,
      changed_fields_json TEXT,
      summary TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (changed_by_user_id) REFERENCES usuario(id) ON DELETE SET NULL
    );

    -- Producao / Divisao de sacas (participantes, acordos, vendas, apuracao)
    CREATE TABLE IF NOT EXISTS participante (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'outro',
      documento TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS politica_custos (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      descricao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS politica_custos_regra (
      id INTEGER PRIMARY KEY,
      politica_custos_id INTEGER NOT NULL,
      custo_tipo TEXT NOT NULL,
      modo_rateio TEXT NOT NULL,
      momento TEXT NOT NULL,
      custom_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      UNIQUE (politica_custos_id, custo_tipo),
      FOREIGN KEY (politica_custos_id) REFERENCES politica_custos(id) ON DELETE CASCADE
    );

    -- Acordo por talhao e safra (tipo_plantio vazio significa "qualquer")
    CREATE TABLE IF NOT EXISTS talhao_acordo (
      id INTEGER PRIMARY KEY,
      talhao_id INTEGER NOT NULL,
      safra_id INTEGER NOT NULL,
      tipo_plantio TEXT NOT NULL DEFAULT '',
      vigencia_de TEXT,
      vigencia_ate TEXT,
      politica_custos_id INTEGER,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      UNIQUE (talhao_id, safra_id, tipo_plantio),
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE RESTRICT,
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE RESTRICT,
      FOREIGN KEY (politica_custos_id) REFERENCES politica_custos(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS talhao_acordo_participante (
      id INTEGER PRIMARY KEY,
      talhao_acordo_id INTEGER NOT NULL,
      participante_id INTEGER NOT NULL,
      papel TEXT NOT NULL DEFAULT 'parceiro',
      percentual_producao REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      UNIQUE (talhao_acordo_id, participante_id),
      FOREIGN KEY (talhao_acordo_id) REFERENCES talhao_acordo(id) ON DELETE CASCADE,
      FOREIGN KEY (participante_id) REFERENCES participante(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS venda_saca (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      data_venda TEXT NOT NULL,
      participante_id INTEGER NOT NULL,
      comprador_tipo TEXT NOT NULL,
      destino_id INTEGER,
      terceiro_nome TEXT,
      tipo_plantio TEXT,
      talhao_id INTEGER,
      sacas REAL NOT NULL,
      preco_por_saca REAL NOT NULL,
      valor_total REAL,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE RESTRICT,
      FOREIGN KEY (participante_id) REFERENCES participante(id) ON DELETE RESTRICT,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE SET NULL,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS custo_lancamento (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      talhao_id INTEGER NOT NULL,
      data_ref TEXT,
      custo_tipo TEXT NOT NULL,
      valor_rs REAL,
      valor_sacas REAL,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE RESTRICT,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS participante_sacas_mov (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      participante_id INTEGER NOT NULL,
      talhao_id INTEGER,
      destino_id INTEGER,
      data_ref TEXT,
      mov_tipo TEXT NOT NULL,
      origem_tipo TEXT,
      origem_id INTEGER,
      custo_tipo TEXT,
      sacas_credito REAL NOT NULL DEFAULT 0,
      sacas_debito REAL NOT NULL DEFAULT 0,
      valor_rs REAL,
      preco_ref_rs_sc REAL,
      pendente_preco INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE RESTRICT,
      FOREIGN KEY (participante_id) REFERENCES participante(id) ON DELETE RESTRICT,
      FOREIGN KEY (talhao_id) REFERENCES talhao(id) ON DELETE SET NULL,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usuario_sessao_user ON usuario_sessao(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_sessao_exp ON usuario_sessao(expires_at);
    CREATE INDEX IF NOT EXISTS idx_role_permission_module ON role_permission(module);
    CREATE INDEX IF NOT EXISTS idx_user_permission_module ON user_permission(module);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_token(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_exp ON password_reset_token(expires_at);

    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(changed_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module_name);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(module_name, record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action_type);

    CREATE INDEX IF NOT EXISTS idx_participante_active ON participante(active);
    CREATE INDEX IF NOT EXISTS idx_participante_deleted ON participante(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_politica_deleted ON politica_custos(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_politica_regra_fk ON politica_custos_regra(politica_custos_id);
    CREATE INDEX IF NOT EXISTS idx_acordo_talhao_safra ON talhao_acordo(talhao_id, safra_id);
    CREATE INDEX IF NOT EXISTS idx_acordo_deleted ON talhao_acordo(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_acordo_part_fk ON talhao_acordo_participante(talhao_acordo_id);
    CREATE INDEX IF NOT EXISTS idx_venda_safra_data ON venda_saca(safra_id, data_venda);
    CREATE INDEX IF NOT EXISTS idx_venda_part ON venda_saca(participante_id);
    CREATE INDEX IF NOT EXISTS idx_venda_deleted ON venda_saca(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_custo_safra_talhao ON custo_lancamento(safra_id, talhao_id);
    CREATE INDEX IF NOT EXISTS idx_mov_safra_part ON participante_sacas_mov(safra_id, participante_id);
    CREATE INDEX IF NOT EXISTS idx_mov_safra_talhao ON participante_sacas_mov(safra_id, talhao_id);
    CREATE INDEX IF NOT EXISTS idx_mov_origem ON participante_sacas_mov(origem_tipo, origem_id);
  `)

  // Evolucao: controle por destino/armazem no extrato de sacas
  try {
    if (!hasColumn('participante_sacas_mov', 'destino_id')) {
      db.exec(`ALTER TABLE participante_sacas_mov ADD COLUMN destino_id INTEGER;`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mov_safra_destino ON participante_sacas_mov(safra_id, destino_id);`)
    }
  } catch {
    // ignore
  }

  // backfill de rateio: viagens antigas (1 talhao -> 100%)
  try {
    db.exec(`
      INSERT INTO viagem_talhao (viagem_id, talhao_id, pct_rateio, kg_rateio, updated_at)
      SELECT v.id, v.talhao_id, 1, v.peso_bruto_kg, datetime('now')
      FROM viagem v
      WHERE NOT EXISTS (
        SELECT 1 FROM viagem_talhao vt WHERE vt.viagem_id = v.id
      );
    `)
  } catch {
    // backfill e opcional (ex: tabela ainda nao existe em DB antigo)
  }

  // Evolucao: custos em sacas por viagem (sem dinheiro)
  try {
    const cols = [
      'custo_frete_sacas',
      'custo_secagem_sacas',
      'custo_silo_sacas',
      'custo_terceiros_sacas',
      'custo_outros_sacas',
    ]
    for (const c of cols) {
      if (!hasColumn('viagem', c)) {
        db.exec(`ALTER TABLE viagem ADD COLUMN ${c} REAL DEFAULT 0;`)
      }
    }
  } catch {
    // ignore
  }

  if (!hasColumn('usuario', 'menus_json')) {
    db.exec('ALTER TABLE usuario ADD COLUMN menus_json TEXT')
  }

  if (!hasColumn('usuario', 'must_change_password')) {
    db.exec('ALTER TABLE usuario ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0')
  }

  if (!hasColumn('usuario', 'email')) {
    db.exec('ALTER TABLE usuario ADD COLUMN email TEXT')
    // Backfill: if username already looks like an email.
    try {
      db.exec("UPDATE usuario SET email=username WHERE email IS NULL AND INSTR(username, '@') > 0")
    } catch {
      // ignore
    }
  }

  // Ensure unique index for email (case-insensitive).
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email_lower ON usuario(LOWER(email))")
  } catch {
    // ignore (older sqlite builds)
  }

  // Rastreabilidade padrao (created/updated by).
  // Campos sao adicionados como NULLable para compatibilidade com registros antigos.
  const traceTables = [
    'safra',
    'destino',
    'talhao',
    'motorista',
    'frete',
    'viagem',
    'viagem_talhao',
    'talhao_safra',
    'plantio_tipo',
    'motorista_quitacao',
    'destino_regra',
    'destino_regra_plantio',
    'umidade_faixa',
    'umidade_faixa_plantio',
    'contrato_silo',
    'contrato_silo_faixa',
    'contrato_silo_arquivo',
    'user_notification_preferences',
    'usuario',
    'role',
    'role_permission',
    'user_permission',

    // producao/divisao
    'participante',
    'politica_custos',
    'politica_custos_regra',
    'talhao_acordo',
    'talhao_acordo_participante',
    'venda_saca',
    'custo_lancamento',
    'participante_sacas_mov',
  ]

  for (const t of traceTables) {
    if (!hasColumn(t, 'created_by_user_id')) {
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN created_by_user_id INTEGER`)
      } catch {
        // ignore
      }
    }
    if (!hasColumn(t, 'updated_by_user_id')) {
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN updated_by_user_id INTEGER`)
      } catch {
        // ignore
      }
    }
  }

  // Soft delete (apenas para tabelas onde faz sentido manter historico).
  // Nota: algumas tabelas possuem UNIQUE constraints no schema original; soft delete
  // mantem a linha (logo nao libera o valor unico). Isso e intencional para nao
  // quebrar compatibilidade sem rebuild de tabela.
  const softDeleteTables = [
    'usuario',
    'safra',
    'destino',
    'talhao',
    'motorista',
    'viagem',
    'contrato_silo_arquivo',
    'plantio_tipo',
    'motorista_quitacao',

    // producao/divisao
    'participante',
    'politica_custos',
    'politica_custos_regra',
    'talhao_acordo',
    'talhao_acordo_participante',
    'venda_saca',
    'custo_lancamento',
  ]
  for (const t of softDeleteTables) {
    if (!hasColumn(t, 'deleted_at')) {
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_at TEXT`)
      } catch {
        // ignore
      }
    }
    if (!hasColumn(t, 'deleted_by_user_id')) {
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_by_user_id INTEGER`)
      } catch {
        // ignore
      }
    }
  }

  // Seed de roles e permissões (nao afeta usuarios existentes).
  // Mantem compatibilidade com o modelo antigo (Permissions.*).
  try {
    const roleCount = Number(db.prepare('SELECT COUNT(*) as c FROM role').get()?.c || 0)
    if (roleCount === 0) {
      const insRole = db.prepare('INSERT INTO role (name) VALUES (?)')
      for (const r of Object.values(Roles)) insRole.run(String(r))
    }

    const permCount = Number(db.prepare('SELECT COUNT(*) as c FROM role_permission').get()?.c || 0)
    if (permCount === 0) {
      const roleIdByName = Object.fromEntries(
        db.prepare('SELECT id, name FROM role').all().map((r) => [String(r.name), Number(r.id)]),
      )

        const modules = [
          'painel',
          'colheita',
          'relatorios',
          'producao',
          'comunicacao',
          'quitacao-motoristas',
          'safras',
          'talhoes',
          'destinos',
          'motoristas',
         'fretes',
        'regras-destino',
        'tipos-plantio',
        'area-colhida',
        'fazenda',
        'usuarios',
        'auditoria',
      ]

      function roleAllows(roleName, moduleKey, action) {
        const role = String(roleName || '').toLowerCase()
        if (role === Roles.ADMIN) return true

        // base: permitir view de painel/fazenda para quem consegue logar.
        if ((moduleKey === 'painel' || moduleKey === 'fazenda') && action === 'view') return true

        const legacy = permsForRole(role)
        const has = (p) => legacy.includes(p)

        const isCad = ['safras', 'talhoes', 'destinos', 'motoristas', 'fretes', 'tipos-plantio'].includes(moduleKey)
        const isConfig = ['regras-destino'].includes(moduleKey)

        if (moduleKey === 'colheita') {
          if (action === 'view') return has(Permissions.COLHEITA_READ)
          return has(Permissions.COLHEITA_WRITE)
        }
        if (moduleKey === 'relatorios' || moduleKey === 'area-colhida') {
          return action === 'view' && has(Permissions.RELATORIOS_READ)
        }
        if (moduleKey === 'producao') {
          if (action === 'view') return has(Permissions.RELATORIOS_READ)
          return has(Permissions.CONFIG_WRITE)
        }
        if (moduleKey === 'comunicacao') {
          return action === 'view' || action === 'update'
        }
        if (moduleKey === 'quitacao-motoristas') {
          if (action === 'view') return has(Permissions.RELATORIOS_READ) || has(Permissions.QUITACOES_WRITE)
          return has(Permissions.QUITACOES_WRITE)
        }
        if (moduleKey === 'usuarios') {
          return has(Permissions.USERS_MANAGE)
        }
        if (isCad) {
          if (action === 'view') return has(Permissions.CADASTROS_READ)
          return has(Permissions.CADASTROS_WRITE)
        }
        if (isConfig) {
          if (action === 'view') return has(Permissions.CONFIG_READ)
          return has(Permissions.CONFIG_WRITE)
        }

        // default deny
        return false
      }

      const ins = db.prepare(
        `INSERT INTO role_permission (role_id, module, can_view, can_create, can_update, can_delete, updated_at)
         VALUES (@role_id, @module, @can_view, @can_create, @can_update, @can_delete, datetime('now'))`,
      )

      for (const roleName of Object.values(Roles)) {
        const role_id = roleIdByName[String(roleName)]
        if (!role_id) continue
        for (const moduleKey of modules) {
          const can_view = roleAllows(roleName, moduleKey, 'view') ? 1 : 0
          const can_create = roleAllows(roleName, moduleKey, 'create') ? 1 : 0
          const can_update = roleAllows(roleName, moduleKey, 'update') ? 1 : 0
          const can_delete = roleAllows(roleName, moduleKey, 'delete') ? 1 : 0
          ins.run({ role_id, module: moduleKey, can_view, can_create, can_update, can_delete })
        }
      }
    }
  } catch (e) {
    logger.warn({ err: String(e?.message || e) }, 'Seed: role/permissions skipped')
  }

  // seed de tipos de plantio
  const countPlantio = db
    .prepare('SELECT COUNT(*) as c FROM plantio_tipo')
    .get().c
  if (countPlantio === 0) {
    const stmt = db.prepare(
      `INSERT INTO plantio_tipo (nome, updated_at) VALUES (?, datetime('now'))`,
    )
    stmt.run('SOJA')
    stmt.run('MILHO')
  }

  // Seed de usuarios *_test: SOMENTE em development e somente quando o DB esta vazio.
  // Em production, nunca criar contas automaticamente.
  try {
    const existing = Number(db.prepare('SELECT COUNT(*) as c FROM usuario').get()?.c || 0)
    if (env.NODE_ENV === 'development' && existing === 0) {
      const seeds = [
        { username: 'admin_test', nome: 'Admin Teste', role: 'admin', password: 'Nazca@2026' },
        { username: 'gestor_test', nome: 'Gestor Teste', role: 'gestor', password: 'Nazca@2026' },
        { username: 'operador_test', nome: 'Operador Teste', role: 'operador', password: 'Nazca@2026' },
        { username: 'leitura_test', nome: 'Leitura Teste', role: 'leitura', password: 'Nazca@2026' },
        { username: 'motorista_test', nome: 'Motorista Teste', role: 'motorista', password: 'Nazca@2026' },
      ]
      const ins = db.prepare(
        `INSERT INTO usuario (username, nome, role, motorista_id, menus_json, password_hash, password_salt, active, updated_at)
         VALUES (@username, @nome, @role, NULL, NULL, @password_hash, @password_salt, 1, datetime('now'))`,
      )
      for (const u of seeds) {
        const { salt, hash } = hashPassword(u.password)
        ins.run({
          username: u.username,
          nome: u.nome,
          role: u.role,
          password_hash: hash,
          password_salt: salt,
        })
      }
      logger.warn({ usernames: seeds.map((x) => x.username) }, 'Seed: usuarios *_test criados (DB vazio, development)')
    }
  } catch (e) {
    logger.warn({ err: String(e?.message || e) }, 'Seed: usuarios *_test skipped')
  }

  // incremental columns for talhao
  if (!hasColumn('talhao', 'irrigacao')) {
    db.exec("ALTER TABLE talhao ADD COLUMN irrigacao TEXT")
  }
  if (!hasColumn('talhao', 'foto_url')) {
    db.exec("ALTER TABLE talhao ADD COLUMN foto_url TEXT")
  }
  if (!hasColumn('talhao', 'maps_url')) {
    db.exec("ALTER TABLE talhao ADD COLUMN maps_url TEXT")
  }
  if (!hasColumn('talhao', 'tipo_solo')) {
    db.exec("ALTER TABLE talhao ADD COLUMN tipo_solo TEXT")
  }
  if (!hasColumn('talhao', 'calagem')) {
    db.exec("ALTER TABLE talhao ADD COLUMN calagem TEXT")
  }
  if (!hasColumn('talhao', 'gessagem')) {
    db.exec("ALTER TABLE talhao ADD COLUMN gessagem TEXT")
  }
  if (!hasColumn('talhao', 'fosforo_corretivo')) {
    db.exec("ALTER TABLE talhao ADD COLUMN fosforo_corretivo TEXT")
  }
  if (!hasColumn('talhao', 'geometry_geojson')) {
    db.exec("ALTER TABLE talhao ADD COLUMN geometry_geojson TEXT")
  }
  if (!hasColumn('talhao', 'geometry_props_json')) {
    db.exec("ALTER TABLE talhao ADD COLUMN geometry_props_json TEXT")
  }
  if (!hasColumn('talhao', 'geometry_source_name')) {
    db.exec("ALTER TABLE talhao ADD COLUMN geometry_source_name TEXT")
  }

  // incremental columns for destino
  if (!hasColumn('destino', 'maps_url')) {
    db.exec("ALTER TABLE destino ADD COLUMN maps_url TEXT")
  }

  if (!hasColumn('contrato_silo_faixa', 'data_entrega')) {
    db.exec('ALTER TABLE contrato_silo_faixa ADD COLUMN data_entrega TEXT')
  }
  if (!hasColumn('contrato_silo_faixa', 'data_pagamento_silo')) {
    db.exec('ALTER TABLE contrato_silo_faixa ADD COLUMN data_pagamento_silo TEXT')
  }
  if (!hasColumn('contrato_silo_faixa', 'participante_id')) {
    db.exec('ALTER TABLE contrato_silo_faixa ADD COLUMN participante_id INTEGER')
  }
  if (!hasColumn('contrato_silo', 'data_pagamento_silo')) {
    db.exec('ALTER TABLE contrato_silo ADD COLUMN data_pagamento_silo TEXT')
  }
  if (!hasColumn('contrato_silo', 'responsavel_tipo')) {
    db.exec('ALTER TABLE contrato_silo ADD COLUMN responsavel_tipo TEXT')
  }
  if (!hasColumn('contrato_silo', 'responsavel_nome')) {
    db.exec('ALTER TABLE contrato_silo ADD COLUMN responsavel_nome TEXT')
  }
  if (!hasColumn('destino_regra_plantio', 'cobrar_secagem_no_silo')) {
    db.exec("ALTER TABLE destino_regra_plantio ADD COLUMN cobrar_secagem_no_silo INTEGER NOT NULL DEFAULT 1")
  }

  // destino: remover trava_sacas (agora fica nas regras por safra+plantio)
  if (hasColumn('destino', 'trava_sacas')) {
    // Se existirem regras plantio sem trava, aproveitar o valor antigo do destino.
    db.exec(`
      UPDATE destino_regra_plantio
      SET trava_sacas = COALESCE(trava_sacas, (SELECT d.trava_sacas FROM destino d WHERE d.id = destino_id))
      WHERE (SELECT d.trava_sacas FROM destino d WHERE d.id = destino_id) IS NOT NULL;
    `)

    db.exec(`
      PRAGMA foreign_keys=off;
      BEGIN;

      CREATE TABLE IF NOT EXISTS destino_new (
        id INTEGER PRIMARY KEY,
        codigo TEXT NOT NULL UNIQUE,
        local TEXT NOT NULL,
        maps_url TEXT,
        distancia_km REAL,
        observacoes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      INSERT INTO destino_new (id, codigo, local, maps_url, distancia_km, observacoes, created_at, updated_at)
      SELECT id, codigo, local, maps_url, distancia_km, observacoes, created_at, updated_at
      FROM destino;

      DROP TABLE destino;
      ALTER TABLE destino_new RENAME TO destino;

      COMMIT;
      PRAGMA foreign_keys=on;
    `)
  }

  // incremental columns for umidade_faixa
  if (!hasColumn('umidade_faixa', 'custo_secagem_por_saca')) {
    db.exec(
      "ALTER TABLE umidade_faixa ADD COLUMN custo_secagem_por_saca REAL NOT NULL DEFAULT 0",
    )
  }

  // incremental columns for destino_regra
  if (!hasColumn('destino_regra', 'custo_silo_por_saca')) {
    db.exec(
      "ALTER TABLE destino_regra ADD COLUMN custo_silo_por_saca REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('destino_regra', 'custo_terceiros_por_saca')) {
    db.exec(
      "ALTER TABLE destino_regra ADD COLUMN custo_terceiros_por_saca REAL NOT NULL DEFAULT 0",
    )
  }

  // indices for plantio rules
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_destino_regra_plantio_safra_destino ON destino_regra_plantio(safra_id, destino_id)',
  )

  // contratos (trava) por safra+destino+plantio
  db.exec(`
    CREATE TABLE IF NOT EXISTS contrato_silo (
      id INTEGER PRIMARY KEY,
      safra_id INTEGER NOT NULL,
      destino_id INTEGER NOT NULL,
      tipo_plantio TEXT NOT NULL,
      sacas_contratadas REAL NOT NULL,
      preco_travado_por_saca REAL NOT NULL,
      data_pagamento_silo TEXT,
      responsavel_tipo TEXT,
      responsavel_nome TEXT,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (safra_id, destino_id, tipo_plantio),
      FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
      FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_contrato_silo_key ON contrato_silo(safra_id, destino_id, tipo_plantio);
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS contrato_silo_faixa (
      id INTEGER PRIMARY KEY,
      contrato_silo_id INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      data_entrega TEXT,
      data_pagamento_silo TEXT,
      participante_id INTEGER,
      sacas REAL NOT NULL,
      preco_por_saca REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (contrato_silo_id, ordem),
      FOREIGN KEY (contrato_silo_id) REFERENCES contrato_silo(id) ON DELETE CASCADE,
      FOREIGN KEY (participante_id) REFERENCES participante(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contrato_silo_faixa_contrato ON contrato_silo_faixa(contrato_silo_id);
  `)

  // arquivos do contrato (documentos digitais)
  db.exec(`
    CREATE TABLE IF NOT EXISTS contrato_silo_arquivo (
      id INTEGER PRIMARY KEY,
      contrato_silo_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (contrato_silo_id) REFERENCES contrato_silo(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_contrato_silo_arquivo_contrato ON contrato_silo_arquivo(contrato_silo_id);
  `)

  // Preferencias de notificacao por e-mail
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      notify_create INTEGER NOT NULL DEFAULT 0,
      notify_update INTEGER NOT NULL DEFAULT 0,
      notify_delete INTEGER NOT NULL DEFAULT 0,
      notify_status_change INTEGER NOT NULL DEFAULT 0,
      notify_security_events INTEGER NOT NULL DEFAULT 0,
      delivery_mode TEXT NOT NULL DEFAULT 'immediate',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (user_id, module),
      FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_notif_pref_user ON user_notification_preferences(user_id);
  `)

  // Dedup de e-mails enviados por evento de auditoria (preparado p/ resumo diario futuramente)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_notification_sent (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      audit_log_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, audit_log_id),
      FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE,
      FOREIGN KEY (audit_log_id) REFERENCES audit_log(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_email_notif_audit ON email_notification_sent(audit_log_id);
  `)
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_umidade_faixa_plantio_regra ON umidade_faixa_plantio(destino_regra_plantio_id)',
  )

  // (removido) destino_compra_faixa_plantio

  // incremental columns for destino_regra_plantio
  if (!hasColumn('destino_regra_plantio', 'valor_compra_por_saca')) {
    db.exec(
      'ALTER TABLE destino_regra_plantio ADD COLUMN valor_compra_por_saca REAL NOT NULL DEFAULT 120',
    )
  }

  // (removido) seed de faixas de compra do silo

  // Cleanup: tabela antiga de compra por faixas (nao usada)
  try {
    db.exec('DROP TABLE IF EXISTS destino_compra_faixa_plantio')
  } catch {
    // ignore
  }

  // Backfill: contratos a partir das regras antigas (trava_sacas + valor_compra_por_saca)
  try {
    db.exec(`
      INSERT OR IGNORE INTO contrato_silo (
        safra_id, destino_id, tipo_plantio,
        sacas_contratadas, preco_travado_por_saca,
        observacoes, updated_at
      )
      SELECT
        safra_id, destino_id, tipo_plantio,
        trava_sacas,
        COALESCE(valor_compra_por_saca, 120),
        'Backfill automatico (destino_regra_plantio)',
        datetime('now')
      FROM destino_regra_plantio
      WHERE trava_sacas IS NOT NULL AND trava_sacas > 0;
    `)
  } catch {
    // opcional
  }

  // Backfill: criar faixa #1 a partir do contrato legado (sacas_contratadas/preco_travado_por_saca)
  try {
    db.exec(`
      INSERT OR IGNORE INTO contrato_silo_faixa (
        contrato_silo_id, ordem, sacas, preco_por_saca, updated_at
      )
      SELECT
        c.id, 1, c.sacas_contratadas, c.preco_travado_por_saca, datetime('now')
      FROM contrato_silo c
      WHERE c.sacas_contratadas IS NOT NULL AND c.sacas_contratadas > 0;
    `)
  } catch {
    // opcional
  }

  // incremental columns for viagem (compra por faixa)
  if (!hasColumn('viagem', 'valor_compra_por_saca_aplicado')) {
    db.exec('ALTER TABLE viagem ADD COLUMN valor_compra_por_saca_aplicado REAL')
  }
  if (!hasColumn('viagem', 'valor_compra_total')) {
    db.exec('ALTER TABLE viagem ADD COLUMN valor_compra_total REAL')
  }
  if (!hasColumn('viagem', 'valor_compra_detalhe_json')) {
    db.exec('ALTER TABLE viagem ADD COLUMN valor_compra_detalhe_json TEXT')
  }
  if (!hasColumn('viagem', 'valor_compra_entrega_antes')) {
    db.exec('ALTER TABLE viagem ADD COLUMN valor_compra_entrega_antes REAL')
  }
  if (!hasColumn('viagem', 'valor_compra_entrega_depois')) {
    db.exec('ALTER TABLE viagem ADD COLUMN valor_compra_entrega_depois REAL')
  }

  // incremental columns for viagem
  if (!hasColumn('viagem', 'custo_silo_por_saca')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN custo_silo_por_saca REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'sub_total_custo_silo')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN sub_total_custo_silo REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'abatimento_total_silo')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN abatimento_total_silo REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'abatimento_por_saca_silo')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN abatimento_por_saca_silo REAL NOT NULL DEFAULT 0",
    )
  }

  if (!hasColumn('viagem', 'custo_terceiros_por_saca')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN custo_terceiros_por_saca REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'sub_total_custo_terceiros')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN sub_total_custo_terceiros REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'abatimento_total_terceiros')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN abatimento_total_terceiros REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'abatimento_por_saca_terceiros')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN abatimento_por_saca_terceiros REAL NOT NULL DEFAULT 0",
    )
  }

  // incremental columns for viagem (secagem)
  if (!hasColumn('viagem', 'secagem_custo_por_saca')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN secagem_custo_por_saca REAL NOT NULL DEFAULT 0",
    )
  }
  if (!hasColumn('viagem', 'sub_total_secagem')) {
    db.exec(
      "ALTER TABLE viagem ADD COLUMN sub_total_secagem REAL NOT NULL DEFAULT 0",
    )
  }

  // safra: marcar qual aparece no painel
  if (!hasColumn('safra', 'painel')) {
    db.exec('ALTER TABLE safra ADD COLUMN painel INTEGER NOT NULL DEFAULT 0')
  }

  // safra: data de referencia (plantio)
  if (!hasColumn('safra', 'data_referencia')) {
    db.exec('ALTER TABLE safra ADD COLUMN data_referencia TEXT')
  }

  // migrate frete to include safra_id (per-safra fretes)
  if (!hasColumn('frete', 'safra_id')) {
    const safraDefault = db.prepare('SELECT id FROM safra ORDER BY id ASC LIMIT 1').get()?.id ?? 1
    db.exec(`
      PRAGMA foreign_keys=off;
      BEGIN;

      CREATE TABLE IF NOT EXISTS frete_new (
        id INTEGER PRIMARY KEY,
        safra_id INTEGER NOT NULL,
        motorista_id INTEGER NOT NULL,
        destino_id INTEGER NOT NULL,
        valor_por_saca REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        UNIQUE (safra_id, motorista_id, destino_id),
        FOREIGN KEY (safra_id) REFERENCES safra(id) ON DELETE CASCADE,
        FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE CASCADE,
        FOREIGN KEY (destino_id) REFERENCES destino(id) ON DELETE CASCADE
      );

      INSERT INTO frete_new (id, safra_id, motorista_id, destino_id, valor_por_saca, created_at, updated_at)
      SELECT id, ${safraDefault} as safra_id, motorista_id, destino_id, valor_por_saca, created_at, updated_at
      FROM frete;

      DROP TABLE frete;
      ALTER TABLE frete_new RENAME TO frete;

      COMMIT;
      PRAGMA foreign_keys=on;
    `)
  }

  // add manual umidade column if db already existed
  if (!hasColumn('viagem', 'umidade_desc_pct_manual')) {
    db.exec('ALTER TABLE viagem ADD COLUMN umidade_desc_pct_manual REAL')
  }

  // recalc: secagem + abatimentos por saca (secagem acompanha sacas limpa/seca)
  if (hasColumn('viagem', 'secagem_custo_por_saca') && hasColumn('viagem', 'sub_total_secagem')) {
    db.exec(`
      UPDATE viagem
      SET
        sub_total_secagem = COALESCE(secagem_custo_por_saca, 0) * COALESCE(sacas, 0),
        abatimento_total_silo = COALESCE(sub_total_frete, 0)
          + (COALESCE(secagem_custo_por_saca, 0) * COALESCE(sacas, 0))
          + COALESCE(sub_total_custo_silo, 0),
        abatimento_por_saca_silo = CASE
          WHEN COALESCE(sacas, 0) > 0 THEN (
            COALESCE(sub_total_frete, 0)
            + (COALESCE(secagem_custo_por_saca, 0) * COALESCE(sacas, 0))
            + COALESCE(sub_total_custo_silo, 0)
          ) / sacas
          ELSE 0
        END,
        abatimento_total_terceiros = COALESCE(sub_total_frete, 0)
          + (COALESCE(secagem_custo_por_saca, 0) * COALESCE(sacas, 0))
          + COALESCE(sub_total_custo_terceiros, 0),
        abatimento_por_saca_terceiros = CASE
          WHEN COALESCE(sacas, 0) > 0 THEN (
            COALESCE(sub_total_frete, 0)
            + (COALESCE(secagem_custo_por_saca, 0) * COALESCE(sacas, 0))
            + COALESCE(sub_total_custo_terceiros, 0)
          ) / sacas
          ELSE 0
        END
    `)
  }
}
