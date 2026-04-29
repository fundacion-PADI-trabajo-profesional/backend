/**
 * DTO para la creación de una zona geográfica.
 *
 * @remarks
 * Solo usuarios con rol `admin` pueden crear zonas.
 * Las zonas agrupan escuelas bajo la supervisión de un encargado de zona.
 */
export interface CreateZonaDto {
  /** Nombre identificatorio de la zona (p. ej. `"Zona Norte"`, `"Zona Sur"`). */
  nombre: string;
}

/**
 * DTO para asignar una escuela a una zona geográfica.
 *
 * @remarks
 * Usado en el endpoint `POST /zonas/:id/escuelas`.
 * La escuela debe existir y no estar asignada a otra zona.
 */
export interface AssignEscuelaDto {
  /** ID de la escuela a asignar. */
  escuela_id: string;
}