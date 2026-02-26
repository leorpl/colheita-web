-- Generated via `prisma migrate diff --from-empty --to-schema-datamodel`.

-- CreateTable
CREATE TABLE "plantio_tipo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "plantio_tipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safra" (
    "id" SERIAL NOT NULL,
    "safra" TEXT NOT NULL,
    "plantio" TEXT,
    "data_referencia" TEXT,
    "area_ha" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "painel" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "safra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talhao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "local" TEXT,
    "nome" TEXT,
    "situacao" TEXT,
    "hectares" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posse" TEXT,
    "contrato" TEXT,
    "observacoes" TEXT,
    "irrigacao" TEXT,
    "foto_url" TEXT,
    "maps_url" TEXT,
    "tipo_solo" TEXT,
    "calagem" TEXT,
    "gessagem" TEXT,
    "fosforo_corretivo" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destino" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "maps_url" TEXT,
    "trava_sacas" DOUBLE PRECISION,
    "distancia_km" DOUBLE PRECISION,
    "observacoes" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "destino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorista" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "placa" TEXT,
    "cpf" TEXT,
    "banco" TEXT,
    "pix_conta" TEXT,
    "tipo_veiculo" TEXT,
    "capacidade_kg" DOUBLE PRECISION,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frete" (
    "id" SERIAL NOT NULL,
    "safra_id" INTEGER NOT NULL,
    "motorista_id" INTEGER NOT NULL,
    "destino_id" INTEGER NOT NULL,
    "valor_por_saca" DOUBLE PRECISION NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "frete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destino_regra" (
    "id" SERIAL NOT NULL,
    "safra_id" INTEGER NOT NULL,
    "destino_id" INTEGER NOT NULL,
    "trava_sacas" DOUBLE PRECISION,
    "custo_silo_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_terceiros_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impureza_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ardidos_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queimados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avariados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esverdiados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quebrados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "destino_regra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destino_regra_plantio" (
    "id" SERIAL NOT NULL,
    "safra_id" INTEGER NOT NULL,
    "destino_id" INTEGER NOT NULL,
    "tipo_plantio" TEXT NOT NULL,
    "trava_sacas" DOUBLE PRECISION,
    "custo_silo_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_terceiros_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impureza_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ardidos_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queimados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avariados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esverdiados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quebrados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "destino_regra_plantio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "umidade_faixa_plantio" (
    "id" SERIAL NOT NULL,
    "destino_regra_plantio_id" INTEGER NOT NULL,
    "umid_gt" DOUBLE PRECISION NOT NULL,
    "umid_lte" DOUBLE PRECISION NOT NULL,
    "desconto_pct" DOUBLE PRECISION NOT NULL,
    "custo_secagem_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "umidade_faixa_plantio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "umidade_faixa" (
    "id" SERIAL NOT NULL,
    "destino_regra_id" INTEGER NOT NULL,
    "umid_gt" DOUBLE PRECISION NOT NULL,
    "umid_lte" DOUBLE PRECISION NOT NULL,
    "desconto_pct" DOUBLE PRECISION NOT NULL,
    "custo_secagem_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "umidade_faixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talhao_safra" (
    "id" SERIAL NOT NULL,
    "safra_id" INTEGER NOT NULL,
    "talhao_id" INTEGER NOT NULL,
    "pct_area_colhida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "talhao_safra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagem" (
    "id" SERIAL NOT NULL,
    "ficha" TEXT NOT NULL,
    "safra_id" INTEGER NOT NULL,
    "tipo_plantio" TEXT,
    "talhao_id" INTEGER NOT NULL,
    "local" TEXT,
    "destino_id" INTEGER NOT NULL,
    "motorista_id" INTEGER NOT NULL,
    "placa" TEXT,
    "data_saida" TEXT,
    "hora_saida" TEXT,
    "data_entrega" TEXT,
    "hora_entrega" TEXT,
    "carga_total_kg" DOUBLE PRECISION NOT NULL,
    "tara_kg" DOUBLE PRECISION NOT NULL,
    "umidade_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impureza_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ardidos_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queimados_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avariados_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esverdiados_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quebrados_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impureza_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ardidos_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queimados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avariados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esverdiados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quebrados_limite_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peso_bruto_kg" DOUBLE PRECISION NOT NULL,
    "umidade_desc_pct" DOUBLE PRECISION NOT NULL,
    "umidade_desc_pct_manual" DOUBLE PRECISION,
    "umidade_kg" DOUBLE PRECISION NOT NULL,
    "impureza_kg" DOUBLE PRECISION NOT NULL,
    "ardidos_kg" DOUBLE PRECISION NOT NULL,
    "queimados_kg" DOUBLE PRECISION NOT NULL,
    "avariados_kg" DOUBLE PRECISION NOT NULL,
    "esverdiados_kg" DOUBLE PRECISION NOT NULL,
    "quebrados_kg" DOUBLE PRECISION NOT NULL,
    "peso_limpo_seco_kg" DOUBLE PRECISION NOT NULL,
    "sacas" DOUBLE PRECISION NOT NULL,
    "sacas_frete" DOUBLE PRECISION NOT NULL,
    "frete_tabela" DOUBLE PRECISION NOT NULL,
    "sub_total_frete" DOUBLE PRECISION NOT NULL,
    "secagem_custo_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sub_total_secagem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_silo_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sub_total_custo_silo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abatimento_total_silo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abatimento_por_saca_silo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_terceiros_por_saca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sub_total_custo_terceiros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abatimento_total_terceiros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abatimento_por_saca_terceiros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "viagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorista_quitacao" (
    "id" SERIAL NOT NULL,
    "motorista_id" INTEGER NOT NULL,
    "de" TEXT NOT NULL,
    "ate" TEXT NOT NULL,
    "data_pagamento" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "forma_pagamento" TEXT,
    "observacoes" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "motorista_quitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "nome" TEXT,
    "role" TEXT NOT NULL,
    "motorista_id" INTEGER,
    "menus_json" TEXT,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,
    "updated_at" TEXT,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_sessao" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (now())::text,

    CONSTRAINT "usuario_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plantio_tipo_nome_key" ON "plantio_tipo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "safra_safra_key" ON "safra"("safra");

-- CreateIndex
CREATE UNIQUE INDEX "talhao_codigo_key" ON "talhao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "destino_codigo_key" ON "destino"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "motorista_nome_key" ON "motorista"("nome");

-- CreateIndex
CREATE INDEX "frete_safra_id_idx" ON "frete"("safra_id");

-- CreateIndex
CREATE INDEX "frete_motorista_id_idx" ON "frete"("motorista_id");

-- CreateIndex
CREATE INDEX "frete_destino_id_idx" ON "frete"("destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "frete_safra_id_motorista_id_destino_id_key" ON "frete"("safra_id", "motorista_id", "destino_id");

-- CreateIndex
CREATE INDEX "destino_regra_safra_id_destino_id_idx" ON "destino_regra"("safra_id", "destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "destino_regra_safra_id_destino_id_key" ON "destino_regra"("safra_id", "destino_id");

-- CreateIndex
CREATE INDEX "destino_regra_plantio_safra_id_destino_id_idx" ON "destino_regra_plantio"("safra_id", "destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "destino_regra_plantio_safra_id_destino_id_tipo_plantio_key" ON "destino_regra_plantio"("safra_id", "destino_id", "tipo_plantio");

-- CreateIndex
CREATE INDEX "umidade_faixa_plantio_destino_regra_plantio_id_idx" ON "umidade_faixa_plantio"("destino_regra_plantio_id");

-- CreateIndex
CREATE INDEX "umidade_faixa_destino_regra_id_idx" ON "umidade_faixa"("destino_regra_id");

-- CreateIndex
CREATE INDEX "talhao_safra_safra_id_idx" ON "talhao_safra"("safra_id");

-- CreateIndex
CREATE INDEX "talhao_safra_talhao_id_idx" ON "talhao_safra"("talhao_id");

-- CreateIndex
CREATE UNIQUE INDEX "talhao_safra_safra_id_talhao_id_key" ON "talhao_safra"("safra_id", "talhao_id");

-- CreateIndex
CREATE INDEX "viagem_safra_id_idx" ON "viagem"("safra_id");

-- CreateIndex
CREATE INDEX "viagem_destino_id_idx" ON "viagem"("destino_id");

-- CreateIndex
CREATE INDEX "viagem_talhao_id_idx" ON "viagem"("talhao_id");

-- CreateIndex
CREATE INDEX "viagem_motorista_id_idx" ON "viagem"("motorista_id");

-- CreateIndex
CREATE INDEX "viagem_data_saida_idx" ON "viagem"("data_saida");

-- CreateIndex
CREATE UNIQUE INDEX "viagem_safra_id_ficha_key" ON "viagem"("safra_id", "ficha");

-- CreateIndex
CREATE INDEX "motorista_quitacao_motorista_id_idx" ON "motorista_quitacao"("motorista_id");

-- CreateIndex
CREATE INDEX "motorista_quitacao_de_ate_idx" ON "motorista_quitacao"("de", "ate");

-- CreateIndex
CREATE INDEX "motorista_quitacao_data_pagamento_idx" ON "motorista_quitacao"("data_pagamento");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_username_key" ON "usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_sessao_token_hash_key" ON "usuario_sessao"("token_hash");

-- CreateIndex
CREATE INDEX "usuario_sessao_usuario_id_idx" ON "usuario_sessao"("usuario_id");

-- CreateIndex
CREATE INDEX "usuario_sessao_expires_at_idx" ON "usuario_sessao"("expires_at");

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destino_regra" ADD CONSTRAINT "destino_regra_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destino_regra" ADD CONSTRAINT "destino_regra_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destino_regra_plantio" ADD CONSTRAINT "destino_regra_plantio_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destino_regra_plantio" ADD CONSTRAINT "destino_regra_plantio_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umidade_faixa_plantio" ADD CONSTRAINT "umidade_faixa_plantio_destino_regra_plantio_id_fkey" FOREIGN KEY ("destino_regra_plantio_id") REFERENCES "destino_regra_plantio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umidade_faixa" ADD CONSTRAINT "umidade_faixa_destino_regra_id_fkey" FOREIGN KEY ("destino_regra_id") REFERENCES "destino_regra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhao_safra" ADD CONSTRAINT "talhao_safra_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhao_safra" ADD CONSTRAINT "talhao_safra_talhao_id_fkey" FOREIGN KEY ("talhao_id") REFERENCES "talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_talhao_id_fkey" FOREIGN KEY ("talhao_id") REFERENCES "talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorista_quitacao" ADD CONSTRAINT "motorista_quitacao_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_sessao" ADD CONSTRAINT "usuario_sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
