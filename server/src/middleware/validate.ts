import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { ApiError } from '../errors.js';

// Valida el body contra un esquema de Zod y lo reemplaza por la versión
// parseada (con trims y coerciones aplicados). Un body inválido corta
// la cadena con 400 antes de llegar al controller.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) =>
          issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
        )
        .join('; ');
      throw ApiError.badRequest(detail);
    }
    req.body = result.data;
    next();
  };
}
