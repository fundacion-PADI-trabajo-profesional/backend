/**
 * Tipo de evaluación (inicial / cierre): validación, ventana anual y mensaje de duplicado.
 *
 * Regla de negocio: un alumno tiene como mucho una evaluación de cada tipo por sala y por año
 * calendario. El año se toma de `fecha_creacion` en UTC, igual que lo muestra el frontend
 * (ver `utils/fechas.ts` del frontend: las fechas se guardan como medianoche UTC).
 */

export const TIPOS_EVALUACION = ["inicial", "cierre"] as const;
export type TipoEvaluacion = (typeof TIPOS_EVALUACION)[number];

export function esTipoEvaluacion(valor: unknown): valor is TipoEvaluacion {
  return typeof valor === "string" && (TIPOS_EVALUACION as readonly string[]).includes(valor);
}

export function anioDe(fecha: Date): number {
  return fecha.getUTCFullYear();
}

/** Rango semiabierto [1/1 del año, 1/1 del año siguiente) en UTC, para filtrar `fecha_creacion`. */
export function rangoAnioUTC(anio: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** Mensaje para la persona cuando ya existe una evaluación del mismo tipo (sala y año iguales). */
export function mensajeTipoDuplicado(tipo: TipoEvaluacion, salaId: number, fecha: Date): string {
  const cuando = `de sala ${salaId} cargada el ${fechaCorta(fecha)}`;
  if (tipo === "inicial") {
    return (
      `Este alumno ya tiene una evaluación inicial ${cuando}. ` +
      "Si esta es de cierre, elegí Cierre; si la anterior está mal, cambiale el tipo o eliminala."
    );
  }
  return `Este alumno ya tiene una evaluación de cierre ${cuando}. Si la anterior está mal, cambiale el tipo o eliminala.`;
}
