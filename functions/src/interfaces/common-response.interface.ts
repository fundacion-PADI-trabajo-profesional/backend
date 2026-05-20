// functions/src/interfaces/common-response.interface.ts
// Contrato y helper para respuestas uniformes.
// ResponseModel: { success, message, data?, error? }
// commonResponse(success, message, data?, error?) crea el objeto estándar.

/**
 * Estructura estándar de todas las respuestas HTTP de la API.
 *
 * @remarks
 * Todos los endpoints del sistema retornan este formato para garantizar
 * consistencia en el cliente. Usar siempre a través del helper `commonResponse`.
 *
 * @example
 * ```json
 * {
 *   "success": true,
 *   "message": "Estudiante creado con éxito",
 *   "data": { "id": "abc123", "nombre": "Juan" },
 *   "error": {}
 * }
 * ```
 */
export interface ResponseModel {
  /** Indica si la operación fue exitosa. */
  success: boolean;
  /** Mensaje descriptivo del resultado, legible por el usuario. */
  message: string;
  /** Payload de la respuesta. `null` cuando no hay datos que retornar. */
  data?: any;
  /** Detalle del error, presente cuando `success` es `false`. */
  error?: {
    /** Código de error interno, por ejemplo `"VALIDATION_ERROR"` o `"DNI_DUPLICADO"`. */
    code?: string;
    /** Descripción técnica del error para facilitar el debugging. */
    description?: string;
  };
}

/**
 * Construye un objeto {@link ResponseModel} con los valores provistos.
 *
 * @param success - `true` si la operación fue exitosa, `false` en caso de error.
 * @param message - Mensaje descriptivo del resultado.
 * @param data - Payload de la respuesta (por defecto `null`).
 * @param error - Objeto de error opcional con `code` y `description`.
 * @returns Un {@link ResponseModel} listo para serializar como JSON.
 *
 * @example
 * ```typescript
 * res.status(201).json(commonResponse(true, "Aula creada con éxito", aula));
 * res.status(400).json(commonResponse(false, "Faltan datos", null, { code: "VALIDATION_ERROR" }));
 * ```
 */
export const commonResponse = (
  success: boolean,
  message: string,
  data: any = null,
  error: { code?: string; description?: string } = {}
): ResponseModel => {
  return {
    success,
    message,
    data,
    error,
  };
};
