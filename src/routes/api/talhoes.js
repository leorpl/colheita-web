import { Router } from 'express'
import multer from 'multer'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { notFound, unprocessable } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, TalhaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'
import { parseTalhaoGeometryZip } from '../../services/talhaoGeometryService.js'

export const talhoesRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const TalhaoBody = TalhaoSchemas.Body

talhoesRouter.get('/', requirePerm(Modules.TALHOES, Actions.VIEW), (_req, res) => {
  res.json(talhaoRepo.list())
})

talhoesRouter.post(
  '/geometry-preview',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  upload.single('file'),
  async (req, res) => {
    if (!req.file?.buffer) throw unprocessable('Arquivo .zip nao enviado')
    const out = await parseTalhaoGeometryZip(req.file.buffer, req.file.originalname)
    res.json(out)
  },
)

talhoesRouter.post(
  '/',
  requirePerm(Modules.TALHOES, Actions.CREATE),
  validateBody(TalhaoBody),
  (req, res) => {
  const row = talhaoRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'talhoes', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

talhoesRouter.get(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
  const row = talhaoRepo.get(req.params.id)
  if (!row) throw notFound('Talhao nao encontrado')
  res.json(row)
  },
)

talhoesRouter.put(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(TalhaoBody),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  const row = talhaoRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

talhoesRouter.delete(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  deleteDependencyService.assertCanDeleteTalhao(Number(id))
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'delete', old_values: exists })
  talhaoRepo.remove(id, { user_id: req.user?.id })
  res.status(204).send()
  },
)
