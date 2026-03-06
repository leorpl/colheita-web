import test from 'node:test'
import assert from 'node:assert/strict'

import { diffShallow, summarizeChange } from '../src/audit/diff.js'

test('diffShallow ignores keys and returns sorted changes', () => {
  const oldV = { a: 1, b: 2, updated_at: 'x' }
  const newV = { a: 1, b: 3, c: 'n', updated_at: 'y' }
  const changed = diffShallow(oldV, newV, { ignoreKeys: ['updated_at'] })
  assert.deepEqual(changed, ['b', 'c'])
})

test('summarizeChange formats update summary', () => {
  const s = summarizeChange({
    action_type: 'update',
    module_name: 'colheita',
    changed_fields: ['destino_id', 'umidade_pct', 'tara_kg'],
  })
  assert.equal(s, 'Alterou 3 campos: destino_id, umidade_pct, tara_kg')
})
