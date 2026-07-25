import type { RequestHandler } from 'express';
import { z } from 'zod';

import { authenticatedUserId } from '../middleware/auth.js';
import { groupIdOf, parseIdParam } from '../middleware/groupAccess.js';
import type { ExpenseService } from '../services/expenseService.js';

const splitSchema = z.object({
  userId: z.number().int().positive(),
  // 0 es válido: aparece al dividir montos menores que la cantidad de personas.
  amountCents: z.number().int().nonnegative(),
});

export const createExpenseSchema = z
  .object({
    description: z.string().trim().min(1, 'La descripción es obligatoria').max(200),
    // Enteros en centavos: el monto mínimo representable es 1 centavo.
    amountCents: z.number().int('El monto debe ser un entero en centavos').positive(),
    paidBy: z.number().int().positive(),
    expenseDate: z.iso.date('La fecha debe tener formato YYYY-MM-DD').optional(),
    splits: z.array(splitSchema).min(1).optional(),
    splitAmong: z.array(z.number().int().positive()).min(1).optional(),
  })
  .refine((data) => (data.splits === undefined) !== (data.splitAmong === undefined), {
    message: 'Indicá exactamente una forma de dividir: splits (montos) o splitAmong (en partes iguales)',
  });

interface ExpenseController {
  create: RequestHandler;
  list: RequestHandler;
  remove: RequestHandler;
}

export function createExpenseController(service: ExpenseService): ExpenseController {
  return {
    create: (req, res) => {
      const input = req.body as z.infer<typeof createExpenseSchema>;
      const expense = service.createExpense(groupIdOf(req), input);
      res.status(201).json({ expense });
    },

    list: (req, res) => {
      res.json({ expenses: service.listExpenses(groupIdOf(req)) });
    },

    remove: (req, res) => {
      const expenseId = parseIdParam(req.params.expenseId, 'El id de gasto');
      service.deleteExpense(groupIdOf(req), expenseId, authenticatedUserId(req));
      res.status(204).end();
    },
  };
}
