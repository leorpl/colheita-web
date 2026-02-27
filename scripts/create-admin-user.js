import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { usuarioRepo } from '../src/repositories/usuarioRepo.js'
import { hashPassword } from '../src/auth/password.js'

function arg(name) {
  const i = process.argv.indexOf(name)
  if (i < 0) return null
  return process.argv[i + 1] ?? null
}

function usage() {
  return `
Uso:
  node scripts/create-admin-user.js --username admin --password "SuaSenhaForte" [--nome "Nome"]
`
}

const username = arg('--username')
const password = arg('--password')
const nome = arg('--nome')

if (!username || !password) {
  console.error(usage())
  process.exit(2)
}

migrate()

const exists = db
  .prepare('SELECT id FROM usuario WHERE username=?')
  .get(username)
if (exists?.id) {
  console.error('Usuario ja existe:', username)
  process.exit(1)
}

const { salt, hash } = hashPassword(password)
const row = usuarioRepo.create({
  username,
  nome: nome || null,
  role: 'admin',
  motorista_id: null,
  password_hash: hash,
  password_salt: salt,
})

console.log('Admin criado:', row)
