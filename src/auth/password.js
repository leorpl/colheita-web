import crypto from 'node:crypto'

export function hashPassword(password, salt) {
  const pwd = String(password || '')
  if (pwd.length < 8) throw new Error('Senha deve ter pelo menos 8 caracteres')
  const s = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pwd, s, 64).toString('hex')
  return { salt: s, hash }
}

export function verifyPassword(password, salt, expectedHash) {
  const pwd = String(password || '')
  const s = String(salt || '')
  const eh = String(expectedHash || '')
  if (!pwd || !s || !eh) return false
  const hash = crypto.scryptSync(pwd, s, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(eh, 'hex'))
  } catch {
    return false
  }
}
