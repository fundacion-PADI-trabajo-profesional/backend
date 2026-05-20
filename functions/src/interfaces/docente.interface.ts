/**
 * Representa un docente con sus aulas y escuelas asignadas, tal como es retornado por la API.
 *
 * @remarks
 * La estructura refleja las relaciones de Prisma:
 * - `profesores_aulas`: aulas individuales donde el docente da clases.
 * - `profesores_escuelas`: escuelas a las que el docente está vinculado institucionalmente.
 * Un docente puede estar asignado a múltiples aulas dentro de una misma escuela.
 */
export interface DocenteItem {
  /** ID único del usuario docente (UUID de Supabase Auth). */
  id: string;
  /** Datos personales del docente, mapeados desde la tabla `personas`. */
  personas: {
    /** Nombre del docente. `null` si no fue cargado. */
    nombre: string | null;
    /** Primer apellido del docente. `null` si no fue cargado. */
    primer_apellido: string | null;
  };
  /** Aulas a las que el docente está asignado como profesor. */
  profesores_aulas?: {
    aula: {
      /** ID único del aula. */
      id: string;
      /** Nombre de la comisión del aula. */
      comision: string;
      /** Turno del aula (`"Mañana"`, `"Tarde"`, etc.). */
      turno: string;
      /** Sala a la que pertenece el aula. `null` si no se incluyó en la consulta. */
      sala?: {
        /** Grado de la sala (p. ej. 3, 4 o 5). `null` si no disponible. */
        grado: number | null;
      } | null;
      /** Escuela a la que pertenece el aula. `null` si no se incluyó en la consulta. */
      escuela?: {
        /** Nombre de la escuela. `null` si no disponible. */
        nombre: string | null;
      } | null;
    };
  }[];
  /** Escuelas a las que el docente está vinculado institucionalmente. */
  profesores_escuelas?: {
    escuela: {
      /** ID único de la escuela. */
      id: string;
      /** Nombre de la escuela. `null` si no disponible. */
      nombre: string | null;
    };
  }[];
}