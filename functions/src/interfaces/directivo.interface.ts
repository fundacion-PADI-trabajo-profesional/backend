/**
 * Representa un directivo tal como es retornado por el listado de la API.
 *
 * @remarks
 * La propiedad `escuela` es `null` si el directivo aún no tiene escuela asignada,
 * lo que lo convierte en candidato para ser asignado a través del panel de administración.
 */
export interface DirectivoItem {
  /** ID único del usuario directivo (UUID de Supabase Auth). */
  id: string;
  /** Nombre del directivo. */
  nombre: string;
  /** Apellido del directivo. */
  apellido: string;
  /**
   * Escuela a la que está asignado.
   * `null` si no tiene escuela asignada aún.
   */
  escuela?: {
    /** ID único de la escuela. */
    id: string;
    /** Nombre de la escuela. */
    nombre: string;
  } | null;
}