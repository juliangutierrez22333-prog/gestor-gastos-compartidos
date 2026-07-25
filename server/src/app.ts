import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

import { ApiError } from './errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ExpenseRepository } from './repositories/expenseRepository.js';
import { GroupRepository } from './repositories/groupRepository.js';
import { SettlementRepository } from './repositories/settlementRepository.js';
import { UserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createGroupRouter } from './routes/groupRoutes.js';
import { AuthService } from './services/authService.js';
import { BalanceService } from './services/balanceService.js';
import { ExpenseService } from './services/expenseService.js';
import { GroupService } from './services/groupService.js';

export interface AppDependencies {
  db: DatabaseSync;
  jwtSecret: string;
  // Límite de intentos para register/login. false lo desactiva (tests que
  // necesitan muchos registros); por defecto 20 intentos cada 15 minutos.
  authRateLimit?: { windowMs: number; limit: number } | false;
  // Ruta absoluta al build del cliente; si se indica, Express lo sirve
  // (producción: un solo proceso para API y frontend, mismo origen).
  clientDist?: string | undefined;
}

// La app recibe sus dependencias en lugar de crearlas (inyección de
// dependencias): los tests le pasan una BD en memoria y un secreto propio,
// y queda separada del listen() para usarla con supertest sin abrir puertos.
export function createApp({ db, jwtSecret, authRateLimit, clientDist }: AppDependencies): express.Express {
  const app = express();

  // Headers de seguridad estándar (CSP, X-Content-Type-Options, etc.).
  app.use(helmet());
  app.use(express.json());

  // Nota para despliegue detrás de un proxy (nginx, Render, Railway):
  // activar app.set('trust proxy', 1) para que el rate limit vea la IP real.
  const authLimiter =
    authRateLimit === false
      ? undefined
      : rateLimit({
          windowMs: authRateLimit?.windowMs ?? 15 * 60 * 1000,
          limit: authRateLimit?.limit ?? 20,
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
        });

  const userRepository = new UserRepository(db);
  const groupRepository = new GroupRepository(db);
  const expenseRepository = new ExpenseRepository(db);
  const settlementRepository = new SettlementRepository(db);
  const authService = new AuthService(userRepository, jwtSecret);
  const groupService = new GroupService(groupRepository, userRepository);
  const expenseService = new ExpenseService(expenseRepository, groupRepository);
  const balanceService = new BalanceService(
    groupRepository,
    expenseRepository,
    settlementRepository,
    userRepository,
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(authService, authLimiter));
  app.use(
    '/api/groups',
    createGroupRouter({
      auth: authService,
      groups: groupRepository,
      groupService,
      expenseService,
      balanceService,
    }),
  );

  // 404 JSON solo para rutas de API desconocidas.
  app.use('/api', (_req, _res, next) => {
    next(ApiError.notFound('Ruta no encontrada'));
  });

  if (clientDist) {
    app.use(express.static(clientDist));
    // Fallback de SPA: cualquier GET que no sea de la API ni un archivo
    // estático devuelve index.html y React Router resuelve la ruta.
    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
