/**
 * Payload para el envío de respuestas de un área de evaluación.
 *
 * @remarks
 * Enviado por el frontend al endpoint `POST /evaluaciones/:id/areas/:areaId/respuestas`.
 * Cada elemento del array `questions` representa una pregunta respondida,
 * donde `answer` es el índice de la opción seleccionada por el evaluador.
 */
export interface SubmitAnswersPayload {
  /** ID de la evaluación a la que pertenecen las respuestas. */
  evaluationId: string;
  /** ID del área dentro de la evaluación que se está completando. */
  areaId: string;
  /**
   * Array de respuestas a las preguntas del área.
   * Cada elemento contiene el ID de la pregunta y la respuesta seleccionada.
   */
  questions: {
    /** ID único de la pregunta. */
    id: string;
    /** Valor numérico de la respuesta seleccionada (índice de la opción). */
    answer: number;
  }[];
}