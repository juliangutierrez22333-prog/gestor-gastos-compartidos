import type { RequestHandler } from 'express';
import { z } from 'zod';

import { authenticatedUserId } from '../middleware/auth.js';
import type { AuthService } from '../services/authService.js';

export const registerSchema = z.object({
  email: z.email('Email inválido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  // Máximo 72: bcrypt ignora los bytes posteriores; aceptar más sería engañoso.
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar 72 caracteres'),
});

export const loginSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  me: RequestHandler;
}

export function createAuthController(auth: AuthService): AuthController {
  return {
    register: async (req, res) => {
      const result = await auth.register(req.body as z.infer<typeof registerSchema>);
      res.status(201).json(result);
    },

    login: async (req, res) => {
      const result = await auth.login(req.body as z.infer<typeof loginSchema>);
      res.json(result);
    },

    me: (req, res) => {
      res.json({ user: auth.getProfile(authenticatedUserId(req)) });
    },
  };
}
