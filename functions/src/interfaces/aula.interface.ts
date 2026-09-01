import type { Turno } from "../utils/turno";

/**
 * DTO para la creación de un aula.
 *
 * @remarks
 * Usado por `AulasService.create` y por `createEscuela` al generar las aulas por defecto
 * (salas 3, 4 y 5) al momento de crear una escuela nueva.
 */
export interface CreateAulaDto {
  /** ID numérico de la sala (p. ej. 3, 4 o 5 para sala de 3, 4 y 5 años). */
  sala_id: number;
  /** Nombre de la comisión, por ejemplo `"Delfines"` o `"Única"`. */
  comision: string;
  /** Turno canónico del aula: `"Mañana"`, `"Tarde"` o `"Completo"`. */
  turno: Turno;
  /**
   * ID de la escuela a la que pertenece el aula.
   * Requerido para usuarios con rol `admin` o `encargado_zona`.
   * Los docentes lo infieren desde su aula asignada.
   */
  escuela_id?: string;
}


