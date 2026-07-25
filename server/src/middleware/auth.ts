import type { Request, RequestHandler } from 'express';

import { ApiError } from '../errors.js';
import type { AuthService } from '../services/authService.js';

export function requireAuth(auth: AuthService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Falta el token de autenticación');
    }
    req.userId = auth.verifyToken(header.slice('Bearer '.length));
    next();
  };
}

// Para handlers que corren detrás de requireAuth: recupera el userId
// sin recurrir a aserciones non-null repartidas por los controllers.
export function authenticatedUserId(req: Request): number {
  if (req.userId === undefined) {
    throw ApiError.unauthorized();
  }
  return req.userId;
}
