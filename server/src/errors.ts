// Error de dominio con código HTTP asociado. Los servicios lanzan ApiError
// y el errorHandler lo traduce a la respuesta; cualquier otro error es un 500.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'No autenticado'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'No tenés permisos para esta acción'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso no encontrado'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }
}
