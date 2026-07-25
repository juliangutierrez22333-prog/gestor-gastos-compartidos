import { Router } from 'express';

import { createExpenseController, createExpenseSchema } from '../controllers/expenseController.js';
import { validateBody } from '../middleware/validate.js';
import type { ExpenseService } from '../services/expenseService.js';

// Se monta en /api/groups/:id/expenses, detrás de requireAuth y
// requireGroupMember. mergeParams permite ver el :id del router padre.
export function createExpenseRouter(service: ExpenseService): Router {
  const router = Router({ mergeParams: true });
  const controller = createExpenseController(service);

  router.post('/', validateBody(createExpenseSchema), controller.create);
  router.get('/', controller.list);
  router.delete('/:expenseId', controller.remove);

  return router;
}
