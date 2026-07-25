import { Router, type RequestHandler } from 'express';

import {
  createAuthController,
  loginSchema,
  registerSchema,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthService } from '../services/authService.js';

export function createAuthRouter(auth: AuthService, rateLimiter?: RequestHandler): Router {
  const router = Router();
  const controller = createAuthController(auth);
  // El límite aplica solo a register/login (superficie de fuerza bruta);
  // /me se llama en cada carga de la SPA y no debe limitarse.
  const limited = rateLimiter ? [rateLimiter] : [];

  router.post('/register', ...limited, validateBody(registerSchema), controller.register);
  router.post('/login', ...limited, validateBody(loginSchema), controller.login);
  router.get('/me', requireAuth(auth), controller.me);

  return router;
}
