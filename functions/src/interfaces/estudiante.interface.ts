/**
 * Datos necesarios para registrar un nuevo estudiante en el sistema.
 *
 * @remarks
 * El campo `apellido` se mapea a la columna `primer_apellido` en la base de datos.
 * El campo `aula_id` es opcional: si se provee, el estudiante queda asignado
 * al aula indicada a través de la tabla relacional `_EstudiantesToAulas`.
 */
export interface CreateEstudianteData {
  /** DNI del estudiante. Debe ser único en el sistema. */
  dni: string;
  /** Nombre del estudiante. */
  nombre: string;
  /** Apellido del estudiante. Se persiste en la columna `primer_apellido`. */
  apellido: string;
  /** Fecha de nacimiento en formato `"YYYY-MM-DD"`. */
  fecha_nacimiento: string;
  /** ID del género del estudiante, referencia a la tabla `generos`. */
  genero_id: string;
  /** ID numérico de la sala (p. ej. 3, 4 o 5 para sala de 3, 4 y 5 años). */
  sala_id: number;
  /** ID de la escuela a la que pertenece el estudiante. */
  escuela_id: string;
  /**
   * ID del aula concreta para la asignación en `_EstudiantesToAulas`.
   * Opcional: si no se provee, el estudiante queda sin aula asignada.
   */
  aula_id?: string;
}