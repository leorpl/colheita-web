import { unprocessable } from '../../../errors.js'
import { normalizePercent100 } from '../../../domain/normalize.js'

export function toDbNumber(value, fieldName) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw unprocessable(`Campo invalido: ${fieldName}`)
  return n
}

export function normalizeOptionalPercent(value, fieldName) {
  if (value === null || value === undefined || value === '') return undefined
  return normalizePercent100(value, fieldName)
}
