import { AppError } from '../errors.js'
import { logger } from '../logger.js'

export function errorHandler(err, req, res, _next) {
  // JSON parse errors (express.json)
  if (
    err instanceof SyntaxError &&
    (err?.type === 'entity.parse.failed' || err?.status === 400)
  ) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'JSON invalido',
      details: null,
      requestId: req.id,
    })
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.name,
      message: err.message,
      details: err.details ?? null,
      requestId: req.id,
    })
  }

  if (err?.name === 'ZodError') {
    const issues = Array.isArray(err.issues) ? err.issues : []
    const details = issues.map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : '',
      message: String(i.message || 'Campo invalido'),
    }))

    return res.status(400).json({
      error: 'BadRequest',
      message: details.length ? details[0].message : 'Requisicao invalida',
      details,
      requestId: req.id,
    })
  }

  logger.error({ err, requestId: req.id }, 'Unhandled error')
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'Internal server error',
    requestId: req.id,
  })
}
