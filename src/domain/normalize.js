import { unprocessable } from '../errors.js'

export function normalizePercent(value, fieldName) {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!Number.isFinite(n)) throw unprocessable(`Campo invalido: ${fieldName}`)
  if (n < 0) throw unprocessable(`Campo invalido: ${fieldName}`)

  // aceita 0..1 ou 0..100
  const p = n > 1 ? n / 100 : n
  if (p > 1) throw unprocessable(`Campo invalido: ${fieldName}`)
  return p
}

// Entrada EXCLUSIVA em percentual 0..100 (com ate 2 casas).
// Retorna fracao 0..1.
export function normalizePercent100(value, fieldName) {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!Number.isFinite(n)) throw unprocessable(`Campo invalido: ${fieldName}`)
  if (n < 0 || n > 100) {
    throw unprocessable(`Campo invalido: ${fieldName} (0 a 100%)`)
  }

  // Aceita 0.00 e 100.00; se for >0 deve ser >=0.01
  if (n > 0 && n < 0.01) {
    throw unprocessable(`Campo invalido: ${fieldName} (minimo 0,01%)`)
  }

  // maximo de 2 casas decimais
  const two = Math.round(n * 100)
  if (Math.abs(two / 100 - n) > 1e-9) {
    throw unprocessable(`Campo invalido: ${fieldName} (max 2 casas decimais)`)
  }

  return n / 100
}

export function round(value, digits = 6) {
  const p = 10 ** digits
  return Math.round((value + Number.EPSILON) * p) / p
}
