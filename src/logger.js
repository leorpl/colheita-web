import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      // pino-http inclui headers da resposta em res.headers
      'res.headers["set-cookie"]',
      // compat: alguns serializers usam res.header
      'res.header["set-cookie"]',
    ],
    remove: true,
  },
})
