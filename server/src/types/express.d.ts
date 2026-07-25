// Extiende el Request de Express con los datos que setean los middlewares:
// userId (requireAuth) y groupId (requireGroupMember).
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      groupId?: number;
    }
  }
}

export {};
