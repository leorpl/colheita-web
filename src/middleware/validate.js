export function validateBody(schema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body)
    next()
  }
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    // Express 5 expõe req.query como getter (read-only). Mutar o objeto em-place.
    const parsed = schema.parse(req.query)
    const q = req.query
    for (const k of Object.keys(q)) delete q[k]
    Object.assign(q, parsed)
    next()
  }
}
