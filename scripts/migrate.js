// CLI helper: run DB migrations safely.
// Usage:
//   node scripts/migrate.js

const { migrate } = await import('../src/db/migrate.js')
migrate()

console.log('[migrate] ok')
