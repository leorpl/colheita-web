export function validateBody(schema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body)
    next()
  }
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.parse(req.query)

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
