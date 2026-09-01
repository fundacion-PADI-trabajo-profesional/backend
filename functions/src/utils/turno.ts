/**
 * Turno canónico de un aula. Los datos reales ya usan estos valores
 * (Title case, con ñ); el resto de este módulo existe para tolerar
 * variantes de texto libre en la escritura y en filtros de reportes.
 */
export const TURNOS = ["Mañana", "Tarde", "Completo"] as const;
export type Turno = (typeof TURNOS)[number];

/** Sinónimos (ya sin acentos y en minúscula) que mapean a "Completo". */
const SINONIMOS_COMPLETO = new Set([
  "completo",
  "completa",
  "unico",
  "jornada completa",
  "doble",
]);

/**
 * Normaliza texto libre al turno canónico; `null` si no se reconoce.
 * Acepta variantes de mayúsculas/acentos/espacios y sinónimos de completo.
 */
export function normalizarTurno(raw: unknown): Turno | null {
  if (typeof raw !== "string") return null;

  const limpio = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (limpio === "manana") return "Mañana";
  if (limpio === "tarde") return "Tarde";
  if (SINONIMOS_COMPLETO.has(limpio)) return "Completo";
  return null;
}
