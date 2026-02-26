import { AppError } from '../errors.js'
import { logger } from '../logger.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.name,
      message: err.message,
      details: err.details ?? null,
      requestId: req.id,
    })
  }

  if (err?.name === 'ZodError') {
    return res.status(422).json({
      error: 'ValidationError',
      message: 'Invalid request',
      details: err.issues,
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
