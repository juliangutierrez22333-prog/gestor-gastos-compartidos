// Extiende el Request de Express con el userId que setea el middleware requireAuth.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export {};
