/**
 * Regla compartida de las pautas de la Prueba PADI.
 * Una pauta es el grupo de sub-preguntas con el mismo `numero` dentro de un área/sala.
 * La usan `calculateAreaScore` (corrección de una evaluación) y el reporte de escuela.
 */

/** Una respuesta es correcta si es `1`, o `0` cuando la pregunta es negativa (`puntaje_invertido`). */
export function esRespuestaCorrecta(
  respuesta: number | null | undefined,
  puntajeInvertido: boolean | null | undefined
): boolean {
  if (respuesta === null || respuesta === undefined) return false;
  return puntajeInvertido ? respuesta === 0 : respuesta === 1;
}

/**
 * Partes correctas con las que se aprueba la pauta: el mínimo cargado en las
 * preguntas (`minimo_aprobacion`, el del cuadernillo) o, si no hay, la mitad
 * redondeada hacia arriba.
 */
export function minimoPauta(g: { total: number; minimo?: number | null }): number {
  return g.minimo === null || g.minimo === undefined ? Math.ceil(g.total / 2) : g.minimo;
}

export function apruebaPauta(g: { total: number; correctas: number; minimo?: number | null }): boolean {
  return g.correctas >= minimoPauta(g);
}

/** El mínimo de una pauta a partir de sus partes: todas traen el mismo valor; si difieren, el más alto. */
export function minimoDePartes(minimos: (number | null | undefined)[]): number | null {
  const valores = minimos.filter((m): m is number => typeof m === "number");
  return valores.length ? Math.max(...valores) : null;
}

/** La pauta está completa cuando todas sus sub-preguntas tienen respuesta. */
export function pautaCompleta(g: { total: number; respondidas: number }): boolean {
  return g.total > 0 && g.respondidas === g.total;
}

/** Clave de agrupación: el `numero` de la pregunta, o `Q:<id>` si no tiene. */
export function claveGrupoPauta(p: { id: string; numero: number | null }): string {
  return p.numero === null || p.numero === undefined ? `Q:${p.id}` : String(p.numero);
}
