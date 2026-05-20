/**
 * Representa un encargado de zona tal como es retornado por el listado de la API.
 *
 * @remarks
 * La propiedad `zona` es `null` si el encargado existe en el sistema pero aún
 * no tiene una zona asignada, lo que lo hace disponible para asignación.
 */
export interface EncargadoItem {
  /** ID único del usuario encargado (UUID de Supabase Auth). */
  id: string;
  /** Nombre del encargado. */
  nombre: string;
  /** Apellido del encargado. */
  apellido: string;
  /** Email de contacto del encargado. */
  email: string;
  /**
   * Zona geográfica a la que está asignado.
   * `null` si aún no tiene zona asignada.
   */
  zona: {
    /** ID único de la zona. */
    id: string;
    /** Nombre de la zona. */
    nombre: string;
  } | null;
}