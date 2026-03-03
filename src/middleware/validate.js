export function validateBody(schema) {
  return (req, _res, next) => {
    // garantia basica: body precisa ser objeto (JSON)
    if (req.body === null || req.body === undefined) req.body = {}
    req.body = schema.parse(req.body)
    next()
  }
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    // Express pode expor query values como string[] (repetidos). Normaliza para 1 valor.
    const raw = req.query || {}
    const normalized = {}
    for (const k of Object.keys(raw)) {
      const v = raw[k]
      normalized[k] = Array.isArray(v) ? v[0] : v
    }

    const parsed = schema.parse(normalized)

    // Express pode expor req.query como getter read-only (dependendo da versao/config).
    // Tenta mutar em-place; se falhar, sobrescreve a propriedade com o objeto validado.
    try {
      const q = req.query
      for (const k of Object.keys(q)) delete q[k]
      Object.assign(q, parsed)
    } catch {
      Object.defineProperty(req, 'query', {
        value: parsed,
        configurable: true,
      })
    }
    next()
  }
}

export function validateParams(schema) {
  return (req, _res, next) => {
    req.params = schema.parse(req.params)
    next()
  }
}
