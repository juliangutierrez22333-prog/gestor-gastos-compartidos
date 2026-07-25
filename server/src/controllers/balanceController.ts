import type { RequestHandler } from 'express';
import { z } from 'zod';

import { authenticatedUserId } from '../middleware/auth.js';
import { groupIdOf } from '../middleware/groupAccess.js';
import type { BalanceService } from '../services/balanceService.js';

export const createSettlementSchema = z.object({
  toUser: z.number().int().positive(),
  amountCents: z.number().int('El monto debe ser un entero en centavos').positive(),
});

interface BalanceController {
  getBalances: RequestHandler;
  createSettlement: RequestHandler;
  listSettlements: RequestHandler;
}

export function createBalanceController(service: BalanceService): BalanceController {
  return {
    getBalances: (req, res) => {
      res.json(service.getGroupBalances(groupIdOf(req)));
    },

    createSettlement: (req, res) => {
      const input = req.body as z.infer<typeof createSettlementSchema>;
      const settlement = service.createSettlement(
        groupIdOf(req),
        authenticatedUserId(req),
        input,
      );
      res.status(201).json({ settlement });
    },

    listSettlements: (req, res) => {
      res.json({ settlements: service.listSettlements(groupIdOf(req)) });
    },
  };
}
