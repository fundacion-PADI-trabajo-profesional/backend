/**
 * Preguntas para el evaluador (ADR 0020): datos de contexto que la persona que evalúa carga en cada
 * evaluación. No suman puntaje ni cambian el estado de la evaluación.
 *
 * - `sesiones_completadas`: sólo en la evaluación de cierre.
 * - `en_tratamiento` / `tiene_cud`: independientes (un chico puede tener CUD y además estar en tratamiento).
 * - `observaciones`: texto libre, hasta {@link MAX_OBSERVACIONES} caracteres.
 *
 * `null` siempre significa "sin responder".
 */
import { ValidationError } from "./errors";

export const RANGOS_SESIONES = ["menos_5", "entre_5_y_9", "10_o_mas"] as const;
export type RangoSesiones = (typeof RANGOS_SESIONES)[number];
export const MAX_OBSERVACIONES = 500;

export interface DatosEvaluador {
  sesiones_completadas: RangoSesiones | null;
  en_tratamiento: boolean | null;
  tiene_cud: boolean | null;
  observaciones: string | null;
}

/** Lo que se muestra del chico en los listados: el dato más reciente que alguien respondió. */
export interface ContextoEvaluador {
  en_tratamiento: boolean | null;
  tiene_cud: boolean | null;
}

function booleanoONull(valor: unknown, campo: string): boolean | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "boolean") {
    throw new ValidationError(`${campo} inválido: debe ser true, false o null`, "DATOS_EVALUADOR_INVALIDOS");
  }
  return valor;
}

/**
 * Valida y normaliza el body de `PUT /evaluaciones/:id/datos-evaluador`.
 * El guardado reemplaza los cuatro campos: lo que no viene queda en null.
 * En una evaluación que no es de cierre, las sesiones se guardan siempre en null.
 *
 * @throws ValidationError (`DATOS_EVALUADOR_INVALIDOS`) si algún campo tiene un valor fuera de lo permitido.
 */
export function normalizarDatosEvaluador(body: unknown, tipoId: string): DatosEvaluador {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Cuerpo inválido: se esperaba un objeto", "DATOS_EVALUADOR_INVALIDOS");
  }
  const b = body as Record<string, unknown>;

  let sesiones: RangoSesiones | null = null;
  if (b.sesiones_completadas !== undefined && b.sesiones_completadas !== null) {
    if (typeof b.sesiones_completadas !== "string" || !(RANGOS_SESIONES as readonly string[]).includes(b.sesiones_completadas)) {
      throw new ValidationError(
        `sesiones_completadas inválido: debe ser ${RANGOS_SESIONES.join(", ")} o null`,
        "DATOS_EVALUADOR_INVALIDOS",
      );
    }
    sesiones = b.sesiones_completadas as RangoSesiones;
  }
  if (tipoId !== "cierre") sesiones = null;

  let observaciones: string | null = null;
  if (b.observaciones !== undefined && b.observaciones !== null) {
    if (typeof b.observaciones !== "string") {
      throw new ValidationError("observaciones inválido: debe ser texto o null", "DATOS_EVALUADOR_INVALIDOS");
    }
    const texto = b.observaciones.trim();
    if (texto.length > MAX_OBSERVACIONES) {
      throw new ValidationError(`observaciones admite hasta ${MAX_OBSERVACIONES} caracteres`, "DATOS_EVALUADOR_INVALIDOS");
    }
    observaciones = texto === "" ? null : texto;
  }

  return {
    sesiones_completadas: sesiones,
    en_tratamiento: booleanoONull(b.en_tratamiento, "en_tratamiento"),
    tiene_cud: booleanoONull(b.tiene_cud, "tiene_cud"),
    observaciones,
  };
}

/**
 * Regla única de "cuál vale hoy" para los listados de alumnos: por cada dato, el de la evaluación
 * más reciente que lo tenga respondido. Los datos se resuelven por separado.
 *
 * @param filas - Evaluaciones de UN estudiante, de la más nueva a la más vieja.
 */
export function resumirContextoEvaluador(
  filas: { en_tratamiento?: boolean | null; tiene_cud?: boolean | null }[],
): ContextoEvaluador {
  const contexto: ContextoEvaluador = { en_tratamiento: null, tiene_cud: null };
  for (const fila of filas) {
    if (contexto.en_tratamiento === null && typeof fila.en_tratamiento === "boolean") contexto.en_tratamiento = fila.en_tratamiento;
    if (contexto.tiene_cud === null && typeof fila.tiene_cud === "boolean") contexto.tiene_cud = fila.tiene_cud;
    if (contexto.en_tratamiento !== null && contexto.tiene_cud !== null) break;
  }
  return contexto;
}

/** Agrupa filas (ya ordenadas de la más nueva a la más vieja) y resume el contexto de cada estudiante. */
export function contextoPorEstudiante(
  filas: { estudiante_id: string; en_tratamiento?: boolean | null; tiene_cud?: boolean | null }[],
): Map<string, ContextoEvaluador> {
  const porEstudiante = new Map<string, typeof filas>();
  for (const fila of filas) {
    const lista = porEstudiante.get(fila.estudiante_id) ?? [];
    lista.push(fila);
    porEstudiante.set(fila.estudiante_id, lista);
  }
  const resultado = new Map<string, ContextoEvaluador>();
  for (const [id, lista] of porEstudiante) resultado.set(id, resumirContextoEvaluador(lista));
  return resultado;
}

export const SIN_CONTEXTO: ContextoEvaluador = { en_tratamiento: null, tiene_cud: null };
