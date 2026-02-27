import { Router } from 'express'
import { z } from 'zod'

import { notFound } from '../../errors.js'
import { validateQuery } from '../../middleware/validate.js'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { viagemRepo } from '../../repositories/viagemRepo.js'
import { talhaoSafraRepo } from '../../repositories/talhaoSafraRepo.js'
import { db } from '../../db/db.js'

export const publicRouter = Router()

publicRouter.get('/talhoes/:id', (req, res) => {
  const id = Number(req.params.id)
  const t = talhaoRepo.get(id)
  if (!t) throw notFound('Talhao nao encontrado')

  res.json({
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    local: t.local,
    situacao: t.situacao,
    hectares: t.hectares,
    maps_url: t.maps_url,
    foto_url: t.foto_url,
    created_at: t.created_at,
    updated_at: t.updated_at,
  })
})

const ResumoQuery = z.object({
  safra_id: z.coerce.number().int().positive().optional(),
  de: z.string().min(1).optional(),
  ate: z.string().min(1).optional(),
})

publicRouter.get(
  '/talhoes/:id/resumo',
  validateQuery(ResumoQuery),
  (req, res) => {
    const talhao_id = Number(req.params.id)
    const t = talhaoRepo.get(talhao_id)
    if (!t) throw notFound('Talhao nao encontrado')

    let safra
    let safra_id = req.query.safra_id
    if (!safra_id) {
      safra = db
        .prepare(
          `SELECT s.id, s.safra
           FROM viagem v
           JOIN safra s ON s.id = v.safra_id
           WHERE v.talhao_id = @talhao_id
           GROUP BY s.id
           ORDER BY (s.data_referencia IS NULL) ASC, s.data_referencia DESC, s.id DESC
           LIMIT 1`,
        )
        .get({ talhao_id })
      safra_id = safra?.id
    } else {
      safra = db
        .prepare('SELECT id, safra FROM safra WHERE id=?')
        .get(Number(safra_id))
    }

    const totals = viagemRepo.totals({
      talhao_id,
      safra_id,
      de: req.query.de,
      ate: req.query.ate,
    })

    let pct_area_colhida = null
    let hectares_colhidos = null
    if (safra_id) {
      const ts = talhaoSafraRepo.get({
        safra_id,
        talhao_id,
      })
      pct_area_colhida = Number(ts?.pct_area_colhida ?? 0)
      if (Number.isFinite(pct_area_colhida)) {
        pct_area_colhida = Math.max(0, Math.min(1, pct_area_colhida))
        hectares_colhidos = Number(t.hectares || 0) * pct_area_colhida
      }
    }

    res.json({
      safra: safra ? { id: safra.id, safra: safra.safra } : null,
      totals: {
        peso_bruto_kg: Number(totals?.peso_bruto_kg || 0),
        sacas: Number(totals?.sacas || 0),
      },
      area: {
        pct_area_colhida,
        hectares_colhidos,
      },
    })
  },
)
