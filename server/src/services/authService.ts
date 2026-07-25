import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { ApiError } from '../errors.js';
import type { UserRepository, UserRow } from '../repositories/userRepository.js';

export interface PublicUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

// Factor de costo de bcrypt: 2^12 iteraciones. Sube el costo de un ataque de
// fuerza bruta sobre hashes robados manteniendo el login en decenas de ms.
const BCRYPT_ROUNDS = 12;
const TOKEN_TTL_SECONDS = 60 * 60 * 2; // 2 horas

// El hash nunca sale de esta capa: hacia afuera solo viaja PublicUser.
function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
  ) {}

  async register(input: { email: string; name: string; password: string }): Promise<AuthResult> {
    if (this.users.findByEmail(input.email)) {
      throw ApiError.conflict('Ya existe una cuenta con ese email');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = this.users.create(input.email, input.name, passwordHash);
    return { user: toPublicUser(user), token: this.signToken(user.id) };
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = this.users.findByEmail(input.email);
    const passwordOk =
      user !== undefined && (await bcrypt.compare(input.password, user.password_hash));

    // Mismo error para "email no existe" y "contraseña incorrecta":
    // distinguirlos permitiría enumerar qué emails están registrados.
    if (!user || !passwordOk) {
      throw ApiError.unauthorized('Email o contraseña incorrectos');
    }
    return { user: toPublicUser(user), token: this.signToken(user.id) };
  }

  getProfile(userId: number): PublicUser {
    const user = this.users.findById(userId);
    if (!user) {
      throw ApiError.unauthorized();
    }
    return toPublicUser(user);
  }

  verifyToken(token: string): number {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      if (typeof payload === 'string' || payload.sub === undefined) {
        throw new Error('payload sin subject');
      }
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId)) {
        throw new Error('subject no numérico');
      }
      return userId;
    } catch {
      throw ApiError.unauthorized('Token inválido o expirado');
    }
  }

  private signToken(userId: number): string {
    return jwt.sign({}, this.jwtSecret, {
      subject: String(userId),
      expiresIn: TOKEN_TTL_SECONDS,
    });
  }
}
