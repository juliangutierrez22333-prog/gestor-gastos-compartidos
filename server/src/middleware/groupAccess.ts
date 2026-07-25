import type { Request, RequestHandler } from 'express';

import { ApiError } from '../errors.js';
import type { GroupRepository } from '../repositories/groupRepository.js';
import { authenticatedUserId } from './auth.js';

// Para handlers que corren detrás de requireGroupMember.
export function groupIdOf(req: Request): number {
  if (req.groupId === undefined) {
    throw ApiError.notFound('Grupo no encontrado');
  }
  return req.groupId;
}

// Express 5 tipa los params como string | string[] (los comodines capturan
// arrays); para un :param simple cualquier cosa que no sea un entero es 400.
export function parseIdParam(value: string | string[] | undefined, label: string): number {
  const id = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(`${label} inválido`);
  }
  return id;
}

// Toda ruta bajo /groups/:id pasa por acá: si el usuario no es miembro,
// responde 404 y no 403 — un 403 le confirmaría a un tercero que el grupo
// existe. Para quien no pertenece, "no existe" y "no tenés acceso" deben
// ser indistinguibles (mismo criterio que usa GitHub con los repos privados).
export function requireGroupMember(groups: GroupRepository): RequestHandler {
  return (req, _res, next) => {
    const groupId = parseIdParam(req.params.id, 'El id de grupo');
    const userId = authenticatedUserId(req);
    if (!groups.isMember(groupId, userId)) {
      throw ApiError.notFound('Grupo no encontrado');
    }
    req.groupId = groupId;
    next();
  };
}
