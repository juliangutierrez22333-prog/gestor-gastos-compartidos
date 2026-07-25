import { Router } from 'express';

import {
  createAuthController,
  loginSchema,
  registerSchema,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthService } from '../services/authService.js';

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();
  const controller = createAuthController(auth);

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);
  router.get('/me', requireAuth(auth), controller.me);

  return router;
}
