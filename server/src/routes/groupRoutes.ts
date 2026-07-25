import { Router } from 'express';

import {
  createBalanceController,
  createSettlementSchema,
} from '../controllers/balanceController.js';
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
import type { BalanceService } from '../services/balanceService.js';
import type { ExpenseService } from '../services/expenseService.js';
import type { GroupService } from '../services/groupService.js';
import { createExpenseRouter } from './expenseRoutes.js';

export interface GroupRouterDeps {
  auth: AuthService;
  groups: GroupRepository;
  groupService: GroupService;
  expenseService: ExpenseService;
  balanceService: BalanceService;
}

export function createGroupRouter(deps: GroupRouterDeps): Router {
  const router = Router();
  const controller = createGroupController(deps.groupService);
  const balances = createBalanceController(deps.balanceService);
  const memberOnly = requireGroupMember(deps.groups);

  // Todas las rutas de grupos requieren usuario autenticado.
  router.use(requireAuth(deps.auth));

  router.post('/', validateBody(createGroupSchema), controller.create);
  router.get('/', controller.list);

  // Las rutas sobre un grupo puntual exigen además ser miembro.
  router.get('/:id', memberOnly, controller.detail);
  router.post('/:id/members', memberOnly, validateBody(addMemberSchema), controller.addMember);
  router.delete('/:id/members/:userId', memberOnly, controller.removeMember);

  router.get('/:id/balances', memberOnly, balances.getBalances);
  router.post(
    '/:id/settlements',
    memberOnly,
    validateBody(createSettlementSchema),
    balances.createSettlement,
  );
  router.get('/:id/settlements', memberOnly, balances.listSettlements);

  // Los gastos viven dentro de un grupo: heredan el chequeo de membresía.
  router.use('/:id/expenses', memberOnly, createExpenseRouter(deps.expenseService));

  return router;
}
