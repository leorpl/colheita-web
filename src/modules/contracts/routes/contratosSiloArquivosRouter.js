import { Router } from 'express'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { validateParams } from '../../../middleware/validate.js'
import { requirePerm } from '../../../middleware/auth.js'
import { Actions, Modules } from '../../../auth/acl.js'
import { S } from '../../../validation/schemaPrimitives.js'
import { notFound, unprocessable } from '../../../errors.js'
import { env } from '../../../config/env.js'
import { contratoSiloRepo } from '../../../repositories/contratoSiloRepo.js'
import { contratoSiloArquivoRepo } from '../../../repositories/contratoSiloArquivoRepo.js'
import { auditService } from '../../../services/auditService.js'

export const contratosSiloArquivosRouter = Router()

function storageBaseDir() {
  const root = path.resolve(path.dirname(env.DB_PATH))
  return path.join(root, 'uploads', 'contratos-silo')
}

function safeFileName(name) {
  const base = path.basename(String(name || '')).trim()
  const cleaned = base
    .replace(/\s+/g, ' ')
    .replace(/[\\/\0\r\n\t]/g, '_')
    .slice(0, 180)
  return cleaned || 'arquivo'
}

function makeStorageKey({ contrato_silo_id, file_name }) {
  const id = Number(contrato_silo_id)
  const ext = path.extname(String(file_name || '')).slice(0, 12)
  const rnd = crypto.randomBytes(8).toString('hex')
  const stamp = Date.now()
  return `contrato-${id}/${stamp}-${rnd}${ext || ''}`
}

function fileAbsPath(storage_key) {
  const p = path.normalize(String(storage_key || ''))
  if (!p || p.startsWith('..') || path.isAbsolute(p)) throw unprocessable('storage_key invalida')
  return path.join(storageBaseDir(), p)
}

// Listar arquivos do contrato
contratosSiloArquivosRouter.get(
  '/contratos-silo/:id/arquivos',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const contrato_silo_id = Number(req.params.id)
    const contrato = contratoSiloRepo.getById(contrato_silo_id)
    if (!contrato) throw notFound('Contrato nao encontrado')
    res.json(contratoSiloArquivoRepo.listByContrato({ contrato_silo_id }))
  },
)

// Upload raw bytes (sem multipart): headers x-file-name, content-type
contratosSiloArquivosRouter.post(
  '/contratos-silo/:id/arquivos',
  requirePerm(Modules.REGRAS_DESTINO, Actions.UPDATE),
  validateParams(S.IdParam),
  express.raw({ type: () => true, limit: '30mb' }),
  (req, res) => {
    const contrato_silo_id = Number(req.params.id)
    const contrato = contratoSiloRepo.getById(contrato_silo_id)
    if (!contrato) throw notFound('Contrato nao encontrado')

    const buf = req.body
    if (!Buffer.isBuffer(buf) || buf.length <= 0) throw unprocessable('Arquivo vazio')
    if (buf.length > 30 * 1024 * 1024) throw unprocessable('Arquivo muito grande (max 30MB)')

    const rawName = req.header('x-file-name') || ''
    let decoded = String(rawName)
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      // ignore
    }
    const file_name = safeFileName(decoded)
    const mime_type = String(req.header('content-type') || 'application/octet-stream').slice(0, 120)
    const file_size = buf.length

    const storage_key = makeStorageKey({ contrato_silo_id, file_name })
    const abs = fileAbsPath(storage_key)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, buf)

    const row = contratoSiloArquivoRepo.create(
      { contrato_silo_id, file_name, storage_key, mime_type, file_size },
      { user_id: req.user?.id },
    )

    auditService.log(req, {
      module_name: 'contratos-silo-arquivos',
      record_id: row.id,
      action_type: 'create',
      new_values: row,
      notes: `contrato_silo_id=${contrato_silo_id}`,
    })

    res.status(201).json(row)
  },
)

// Download
contratosSiloArquivosRouter.get(
  '/contratos-silo/arquivos/:id/download',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const id = Number(req.params.id)
    const row = contratoSiloArquivoRepo.get(id)
    if (!row) throw notFound('Arquivo nao encontrado')

    const abs = fileAbsPath(row.storage_key)
    if (!fs.existsSync(abs)) throw notFound('Arquivo nao encontrado no disco')

    res.setHeader('content-type', row.mime_type || 'application/octet-stream')
    res.setHeader(
      'content-disposition',
      `attachment; filename="${String(row.file_name || 'arquivo').replaceAll('"', '')}"`,
    )
    res.sendFile(abs)
  },
)

// Delete
contratosSiloArquivosRouter.delete(
  '/contratos-silo/arquivos/:id',
  requirePerm(Modules.REGRAS_DESTINO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = Number(req.params.id)
    const row = contratoSiloArquivoRepo.get(id)
    if (!row) throw notFound('Arquivo nao encontrado')

    // best-effort unlink
    try {
      const abs = fileAbsPath(row.storage_key)
      if (fs.existsSync(abs)) fs.unlinkSync(abs)
    } catch {
      // ignore
    }

    contratoSiloArquivoRepo.remove(id, { user_id: req.user?.id })

    auditService.log(req, {
      module_name: 'contratos-silo-arquivos',
      record_id: id,
      action_type: 'delete',
      old_values: row,
    })
    res.status(204).send()
  },
)
