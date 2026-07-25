import { Router } from 'express';

import {
  addMemberSchema,
  createGroupController,
  createGroupSchema,
} from '../controllers/groupController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/groupAccess.js';
import { validateBody } from '../middleware/validate.js';
import type { GroupRepository } from '../repositories/groupRepository.js';
import type { AuthService } from '../services/authService.js';
import type { GroupService } from '../services/groupService.js';

export function createGroupRouter(
  auth: AuthService,
  groups: GroupRepository,
  service: GroupService,
): Router {
  const router = Router();
  const controller = createGroupController(service);

  // Todas las rutas de grupos requieren usuario autenticado.
  router.use(requireAuth(auth));

  router.post('/', validateBody(createGroupSchema), controller.create);
  router.get('/', controller.list);

  // Las rutas sobre un grupo puntual exigen además ser miembro.
  router.get('/:id', requireGroupMember(groups), controller.detail);
  router.post(
    '/:id/members',
    requireGroupMember(groups),
    validateBody(addMemberSchema),
    controller.addMember,
  );
  router.delete('/:id/members/:userId', requireGroupMember(groups), controller.removeMember);

  return router;
}
