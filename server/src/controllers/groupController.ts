import type { RequestHandler } from 'express';
import { z } from 'zod';

import { authenticatedUserId } from '../middleware/auth.js';
import { groupIdOf, parseIdParam } from '../middleware/groupAccess.js';
import type { GroupService } from '../services/groupService.js';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del grupo es obligatorio').max(100),
});

export const addMemberSchema = z.object({
  email: z.email('Email inválido'),
});

interface GroupController {
  create: RequestHandler;
  list: RequestHandler;
  detail: RequestHandler;
  addMember: RequestHandler;
  removeMember: RequestHandler;
}

export function createGroupController(service: GroupService): GroupController {
  return {
    create: (req, res) => {
      const { name } = req.body as z.infer<typeof createGroupSchema>;
      const group = service.createGroup(name, authenticatedUserId(req));
      res.status(201).json({ group });
    },

    list: (req, res) => {
      res.json({ groups: service.listGroups(authenticatedUserId(req)) });
    },

    detail: (req, res) => {
      res.json(service.getGroupDetail(groupIdOf(req)));
    },

    addMember: (req, res) => {
      const { email } = req.body as z.infer<typeof addMemberSchema>;
      const members = service.addMemberByEmail(groupIdOf(req), email);
      res.status(201).json({ members });
    },

    removeMember: (req, res) => {
      const targetUserId = parseIdParam(req.params.userId, 'El id de usuario');
      service.removeMember(groupIdOf(req), targetUserId, authenticatedUserId(req));
      res.status(204).end();
    },
  };
}
