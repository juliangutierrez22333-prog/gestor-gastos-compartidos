import { ApiError } from '../errors.js';
import type { GroupMemberRow, GroupRepository, GroupRow } from '../repositories/groupRepository.js';
import type { UserRepository } from '../repositories/userRepository.js';

// Hacia afuera la API habla camelCase; snake_case es un detalle de la BD
// que no debe filtrarse a los clientes.
export interface GroupSummary {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
}

export interface GroupMember {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
}

function toSummary(row: GroupRow): GroupSummary {
  return { id: row.id, name: row.name, createdBy: row.created_by, createdAt: row.created_at };
}

function toMember(row: GroupMemberRow): GroupMember {
  return { id: row.user_id, name: row.name, email: row.email, joinedAt: row.joined_at };
}

export class GroupService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly users: UserRepository,
  ) {}

  createGroup(name: string, creatorId: number): GroupSummary {
    return toSummary(this.groups.create(name, creatorId));
  }

  listGroups(userId: number): GroupSummary[] {
    return this.groups.listByUser(userId).map(toSummary);
  }

  getGroupDetail(groupId: number): { group: GroupSummary; members: GroupMember[] } {
    const group = this.groups.findById(groupId);
    if (!group) {
      throw ApiError.notFound('Grupo no encontrado');
    }
    return { group: toSummary(group), members: this.groups.listMembers(groupId).map(toMember) };
  }

  addMemberByEmail(groupId: number, email: string): GroupMember[] {
    const user = this.users.findByEmail(email);
    if (!user) {
      throw ApiError.notFound('No existe un usuario registrado con ese email');
    }
    if (this.groups.isMember(groupId, user.id)) {
      throw ApiError.conflict('Ese usuario ya es miembro del grupo');
    }
    this.groups.addMember(groupId, user.id);
    return this.groups.listMembers(groupId).map(toMember);
  }

  // Reglas: cualquier miembro puede salir por su cuenta; solo el creador
  // puede eliminar a otros; el creador no puede salir (dejaría el grupo
  // sin responsable — limitación deliberada del alcance actual).
  removeMember(groupId: number, targetUserId: number, requesterId: number): void {
    const group = this.groups.findById(groupId);
    if (!group) {
      throw ApiError.notFound('Grupo no encontrado');
    }
    if (!this.groups.isMember(groupId, targetUserId)) {
      throw ApiError.notFound('Ese usuario no es miembro del grupo');
    }
    // Primero permisos del solicitante (403), después reglas sobre el
    // objetivo (400): sin permiso, la respuesta no debe variar según quién
    // sea el objetivo.
    if (requesterId !== targetUserId && requesterId !== group.created_by) {
      throw ApiError.forbidden('Solo el creador puede eliminar a otros miembros');
    }
    if (targetUserId === group.created_by) {
      throw ApiError.badRequest('El creador no puede salir de su propio grupo');
    }
    this.groups.removeMember(groupId, targetUserId);
  }
}
