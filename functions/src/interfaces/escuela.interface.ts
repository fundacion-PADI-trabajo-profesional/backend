/**
 * DTO para la creación de una escuela.
 *
 * @remarks
 * El campo `zona_id` es obligatorio cuando el solicitante es un usuario PADI (admin).
 * Si el solicitante es un encargado de zona, `zona_id` puede inferirse automáticamente
 * desde su perfil. El campo `encargado_id` se autocompleta en ese caso.
 */
export interface CreateEscuelaDto {
  /** Nombre de la institución educativa. */
  nombre: string;
  /** Dirección física de la escuela. Opcional. */
  direccion?: string;
  /** Teléfono de contacto de la escuela. Opcional. */
  telefono?: string;
  /**
   * ID de la zona geográfica a la que pertenece la escuela.
   * Requerido cuando quien crea es un usuario PADI (admin).
   */
  zona_id: string;
}