import type { ErrorRequestHandler } from 'express';

import { ApiError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  // Error no previsto: se loguea completo pero al cliente no se le filtra
  // ningún detalle interno (stack traces, SQL, rutas de archivos).
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
};
