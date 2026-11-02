/** Error lanzado cuando el usuario no tiene permisos para realizar la operación. */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Error lanzado cuando el recurso pedido no existe. Los controllers lo mapean a 404. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Error de validación de entrada con un código estable para el cliente. Los controllers lo mapean a 400. */
export class ValidationError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

/** Datos mínimos de la evaluación que ya existe y provoca el rechazo por duplicado. */
export interface EvaluacionExistente {
  id: string;
  tipo_id: string;
  fecha_creacion: Date;
}

/**
 * El alumno ya tiene una evaluación del mismo tipo en la misma sala y año.
 * Los controllers lo mapean a 400 con `error.code = "TIPO_DUPLICADO"` y la evaluación existente en `error.details`.
 */
export class TipoDuplicadoError extends Error {
  readonly code = "TIPO_DUPLICADO";
  readonly evaluacionExistente: EvaluacionExistente;
  constructor(message: string, evaluacionExistente: EvaluacionExistente) {
    super(message);
    this.name = "TipoDuplicadoError";
    this.evaluacionExistente = evaluacionExistente;
  }
}
