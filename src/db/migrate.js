import { db } from './db.js'

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS destino (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      local TEXT NOT NULL,
      maps_url TEXT,
      trava_sacas REAL,
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

      secagem_custo_por_saca REAL NOT NULL DEFAULT 0,
      sub_total_secagem REAL NOT NULL DEFAULT 0,

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
      nome TEXT,
      role TEXT NOT NULL,
      motorista_id INTEGER,
      menus_json TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_usuario_sessao_user ON usuario_sessao(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_sessao_exp ON usuario_sessao(expires_at);
  `)

  if (!hasColumn('usuario', 'menus_json')) {
    db.exec('ALTER TABLE usuario ADD COLUMN menus_json TEXT')
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

  // incremental columns for destino
  if (!hasColumn('destino', 'maps_url')) {
    db.exec("ALTER TABLE destino ADD COLUMN maps_url TEXT")
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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_umidade_faixa_plantio_regra ON umidade_faixa_plantio(destino_regra_plantio_id)',
  )

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
}
