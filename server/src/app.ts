import type { DatabaseSync } from 'node:sqlite';

import express from 'express';

import { ApiError } from './errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ExpenseRepository } from './repositories/expenseRepository.js';
import { GroupRepository } from './repositories/groupRepository.js';
import { UserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createGroupRouter } from './routes/groupRoutes.js';
import { AuthService } from './services/authService.js';
import { ExpenseService } from './services/expenseService.js';
import { GroupService } from './services/groupService.js';

export interface AppDependencies {
  db: DatabaseSync;
  jwtSecret: string;
}

// La app recibe sus dependencias en lugar de crearlas (inyección de
// dependencias): los tests le pasan una BD en memoria y un secreto propio,
// y queda separada del listen() para usarla con supertest sin abrir puertos.
export function createApp({ db, jwtSecret }: AppDependencies): express.Express {
  const app = express();
  app.use(express.json());

  const userRepository = new UserRepository(db);
  const groupRepository = new GroupRepository(db);
  const expenseRepository = new ExpenseRepository(db);
  const authService = new AuthService(userRepository, jwtSecret);
  const groupService = new GroupService(groupRepository, userRepository);
  const expenseService = new ExpenseService(expenseRepository, groupRepository);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(authService));
  app.use(
    '/api/groups',
    createGroupRouter(authService, groupRepository, groupService, expenseService),
  );

  app.use((_req, _res, next) => {
    next(ApiError.notFound('Ruta no encontrada'));
  });
  app.use(errorHandler);

  return app;
}
