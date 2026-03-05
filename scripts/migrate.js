// CLI helper: run DB migrations safely.
// Usage:
//   node scripts/migrate.js
//   node scripts/migrate.js --seed-test-users

if (process.argv.includes('--seed-test-users')) {
  process.env.SEED_TEST_USERS = '1'
}

const { migrate } = await import('../src/db/migrate.js')
migrate()

console.log('[migrate] ok')
