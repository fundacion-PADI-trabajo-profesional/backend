/**
 * Calcula las fechas de inicio y fin de un año calendario completo en UTC.
 *
 * @param anio - Año a calcular (ej. 2024).
 * @returns `periodoStart` (1 de enero 00:00 UTC) y `periodoEnd` (1 de enero del año siguiente, exclusivo).
 */
export function getPeriodoRange(anio: number) {
  return {
    periodoStart: new Date(Date.UTC(anio, 0, 1)),
    periodoEnd: new Date(Date.UTC(anio + 1, 0, 1)),
  };
}
