import { Router } from 'express'
import { z } from 'zod'

import { validateBody, validateParams } from '../../middleware/validate.js'
import { requireCan } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { notFound } from '../../errors.js'
import { aclRepo } from '../../repositories/aclRepo.js'
import { auditService } from '../../services/auditService.js'
import { roleSyncService } from '../../services/roleSyncService.js'

export const aclRouter = Router()

// Somente admin/usuarios-manage (via ACL do modulo usuarios)
aclRouter.use(requireCan(Modules.USUARIOS, Actions.UPDATE))

const RoleParam = z.object({ role: z.string().trim().min(1).max(40) })
const ModuleParam = z.object({ module: z.string().trim().min(1).max(60) })

const CreateRoleBody = z.object({
  name: z.string().trim().min(1).max(40),
})

aclRouter.get('/roles', (_req, res) => {
  res.json(aclRepo.listRoles())
})

aclRouter.post('/roles', validateBody(CreateRoleBody), (req, res) => {
  const roleId = aclRepo.createRole(req.body.name)
  if (!roleId) throw notFound('Nao foi possivel criar role')
  auditService.log(req, {
    module_name: 'permissoes',
    record_id: roleId,
    action_type: 'permission_change',
    notes: `role_create ${String(req.body.name || '').trim()}`,
  })
  res.status(201).json({ ok: true, id: roleId })
})

aclRouter.get('/roles/:role/permissions', validateParams(RoleParam), (req, res) => {
  res.json(aclRepo.getRolePermissionsByRoleName(req.params.role))
})

const RolePermBody = z.object({
  can_view: z.coerce.boolean(),
  can_create: z.coerce.boolean(),
  can_update: z.coerce.boolean(),
  can_delete: z.coerce.boolean(),
})

const CloneRoleBody = z.object({
  to_name: z.string().trim().min(1).max(40),
})

aclRouter.put(
  '/roles/:role/permissions/:module',
  validateParams(RoleParam.merge(ModuleParam)),
  validateBody(RolePermBody),
  (req, res) => {
    const before = aclRepo.getRolePermissionsByRoleName(req.params.role)
    const after = aclRepo.upsertRolePermission({
      roleName: req.params.role,
      module: req.params.module,
      ...req.body,
    })
    if (!after) throw notFound('Role nao encontrada')

    auditService.log(req, {
      module_name: 'permissoes',
      record_id: Number(aclRepo.getRoleIdByName(req.params.role) || null),
      action_type: 'permission_change',
      old_values: { role: req.params.role, permissions: before },
      new_values: { role: req.params.role, permissions: after },
      notes: `role_permission ${req.params.role} ${req.params.module}`,
    })

    // Sync menu list for users bound to this role.
    try {
      roleSyncService.syncUsersMenusForRole(req.params.role, { user_id: req.user?.id })
    } catch {
      // ignore
    }

    res.json(after)
  },
)

aclRouter.post(
  '/roles/:role/clone',
  validateParams(RoleParam),
  validateBody(CloneRoleBody),
  (req, res) => {
    const before = aclRepo.getRolePermissionsByRoleName(req.params.role)
    const after = aclRepo.cloneRolePermissions({
      fromRoleName: req.params.role,
      toRoleName: req.body.to_name,
    })
    if (!after) throw notFound('Role origem nao encontrada')

    auditService.log(req, {
      module_name: 'permissoes',
      record_id: Number(aclRepo.getRoleIdByName(req.body.to_name) || null),
      action_type: 'permission_change',
      old_values: { role: req.params.role, permissions: before },
      new_values: { role: req.body.to_name, permissions: after },
      notes: `role_clone ${req.params.role} -> ${req.body.to_name}`,
    })

    try {
      roleSyncService.syncUsersMenusForRole(req.body.to_name, { user_id: req.user?.id })
    } catch {
      // ignore
    }

    res.status(201).json(after)
  },
)

const UserIdParam = z.object({ id: z.coerce.number().int().positive() })

aclRouter.get('/users/:id/overrides', validateParams(UserIdParam), (req, res) => {
  res.json(aclRepo.getUserPermissionOverrides(Number(req.params.id)))
})

const UserOverrideBody = z.object({
  // null => herdar
  can_view: z.union([z.coerce.boolean(), z.null()]).optional(),
  can_create: z.union([z.coerce.boolean(), z.null()]).optional(),
  can_update: z.union([z.coerce.boolean(), z.null()]).optional(),
  can_delete: z.union([z.coerce.boolean(), z.null()]).optional(),
})

aclRouter.put(
  '/users/:id/overrides/:module',
  validateParams(UserIdParam.merge(ModuleParam)),
  validateBody(UserOverrideBody),
  (req, res) => {
    const user_id = Number(req.params.id)
    const module = req.params.module

    const before = aclRepo.getUserPermissionOverrides(user_id)
    const after = aclRepo.upsertUserOverride({ user_id, module, ...req.body })
    if (!after) throw notFound('Usuario nao encontrado')

    auditService.log(req, {
      module_name: 'permissoes',
      record_id: user_id,
      action_type: 'permission_change',
      old_values: before,
      new_values: after,
      notes: `user_permission user=${user_id} ${module}`,
    })

    res.json(after)
  },
)

aclRouter.delete(
  '/users/:id/overrides/:module',
  validateParams(UserIdParam.merge(ModuleParam)),
  (req, res) => {
    const user_id = Number(req.params.id)
    const module = req.params.module

    const before = aclRepo.getUserPermissionOverrides(user_id)
    aclRepo.removeUserOverride({ user_id, module })
    const after = aclRepo.getUserPermissionOverrides(user_id)

    auditService.log(req, {
      module_name: 'permissoes',
      record_id: user_id,
      action_type: 'permission_change',
      old_values: before,
      new_values: after,
      notes: `user_permission delete user=${user_id} ${module}`,
    })

    res.status(204).send()
  },
)
