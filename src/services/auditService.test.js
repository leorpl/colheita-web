import test from 'node:test'
import assert from 'node:assert/strict'

import { auditService } from './auditService.js'
import { auditLogRepo } from '../repositories/auditLogRepo.js'

test('auditService.log sanitizes sensitive fields', () => {
  const calls = []
  const orig = auditLogRepo.create
  auditLogRepo.create = (row) => {
    calls.push(row)
    return row
  }

  const req = {
    user: { id: 10, username: 'admin', nome: 'Admin' },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test' },
  }

  auditService.log(req, {
    module_name: 'usuarios',
    record_id: 99,
    action_type: 'update',
    old_values: { password_hash: 'x', password_salt: 'y', menus_json: '["a"]', foo: 1 },
    new_values: { password_hash: 'z', password_salt: 'w', menus_json: '["b"]', foo: 2 },
  })

  assert.equal(calls.length, 1)
  const row = calls[0]
  assert.equal(row.module_name, 'usuarios')
  assert.equal(row.record_id, 99)
  assert.equal(row.changed_by_user_id, 10)
  assert.ok(!String(row.old_values_json).includes('password_hash'))
  assert.ok(!String(row.old_values_json).includes('password_salt'))
  assert.ok(!String(row.new_values_json).includes('password_hash'))
  assert.ok(!String(row.new_values_json).includes('password_salt'))
  assert.ok(!String(row.old_values_json).includes('menus_json'))
  assert.ok(!String(row.new_values_json).includes('menus_json'))

  auditLogRepo.create = orig
})

test('auditService.log ignores timestamp/by fields in diff', () => {
  const calls = []
  const orig = auditLogRepo.create
  auditLogRepo.create = (row) => {
    calls.push(row)
    return row
  }

  const req = { user: { id: 1, username: 'u' }, ip: '::1', headers: {} }

  auditService.log(req, {
    module_name: 'safras',
    record_id: 1,
    action_type: 'update',
    old_values: { id: 1, safra: '2025', updated_at: 'a', updated_by_user_id: 1 },
    new_values: { id: 1, safra: '2025', updated_at: 'b', updated_by_user_id: 2 },
  })

  const changed = JSON.parse(String(calls[0].changed_fields_json || '[]'))
  assert.deepEqual(changed, [])

  auditLogRepo.create = orig
})
