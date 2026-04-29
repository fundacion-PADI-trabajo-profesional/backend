/**
 * DTO para la creación de una nueva instancia de evaluación.
 *
 * @remarks
 * El sistema localiza al estudiante a través de su `dni`.
 * El `tipo_id` determina si es una evaluación de inicio o cierre del ciclo.
 * Aunque `aula_id` es opcional, se recomienda incluirlo para trazabilidad
 * y para que los filtros por aula funcionen correctamente.
 */
export interface CreateEvaluacionDTO {
  /** DNI del estudiante a evaluar. Se usa para localizar su registro en la base de datos. */
  dni: string;
  /** Tipo de evaluación: `"inicial"` (inicio de ciclo) o `"cierre"` (fin de ciclo). */
  tipo_id: string;
  /** UUID del docente que realiza la evaluación (ID de Supabase Auth). */
  profesor_id: string;
  /** Fecha de creación en formato ISO (`"YYYY-MM-DDTHH:mm:ssZ"`) o `"YYYY-MM"`. */
  fecha_creacion: string;
  /**
   * UUID del aula donde se realiza la evaluación.
   * Opcional, pero recomendado para trazabilidad y filtros por aula.
   */
  aula_id?: string;
  /** ID numérico de la sala (p. ej. 3, 4 o 5). */
  sala_id: number;
}

/**
 * Resumen del estado de un área dentro de una evaluación.
 *
 * @remarks
 * Usado en las respuestas del listado de evaluaciones para mostrar
 * el progreso y puntaje por área sin exponer el detalle de cada pregunta.
 */
export interface AreaSummary {
  /** ID único del área de evaluación. */
  id: string;
  /** Nombre del área (p. ej. `"Lenguaje"`, `"Matemática"`). */
  nombre: string;
  /** Descripción del área. */
  descripcion: string;
  /** ID del estado actual del área (p. ej. `"pendiente"`, `"completada"`). */
  estado_id: string;
  /** Puntaje obtenido en el área. `null` si aún no fue completada. */
  puntaje: number | null;
  /** Cantidad de aciertos individuales en el área. Presente solo en algunas consultas. */
  aciertos_individuales?: number;
}