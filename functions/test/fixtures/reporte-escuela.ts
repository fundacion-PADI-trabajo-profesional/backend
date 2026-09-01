import type {
  EvaluacionReporteRow, RespuestaReporteRow, CatalogosReporte, ReporteInput,
} from "../../src/interfaces/reporte-escuela.interface";

export const AREAS = [
  { id: "sm", nombre: "Sensoriomotora", orden: 1 },
  { id: "cl", nombre: "Comunicación y Lenguaje", orden: 2 },
  { id: "cog", nombre: "Cognitiva", orden: 3 },
  { id: "se", nombre: "Socioemocional", orden: 4 },
];
export const SALAS = [{ id: 3, nombre: "Sala de 3" }, { id: 4, nombre: "Sala de 4" }, { id: 5, nombre: "Sala de 5" }];
export const CATALOGOS: CatalogosReporte = { salas: SALAS, areas: AREAS };
export const ESCUELA = { id: "esc-1", nombre: "Jardín Municipal N° 1" };
export const GENERADO = new Date("2026-09-01T12:00:00.000Z");

/** Estados por área: las que no se listan quedan en "A". `omitir` deja el área sin registro. */
export function mkEval(o: {
  id: string; est: string; tipo: "inicial" | "cierre";
  desaprueba?: string[]; omitir?: string[]; estado?: "A" | "D";
  sala?: number; fecha?: string; apellido?: string; apellido2?: string | null; nombre?: string;
}): EvaluacionReporteRow {
  const desaprueba = o.desaprueba ?? [];
  const omitir = o.omitir ?? [];
  const areas = AREAS.filter((a) => !omitir.includes(a.id)).map((a) => ({
    area_id: a.id, estado_id: desaprueba.includes(a.id) ? "D" : "A",
  }));
  return {
    id: o.id, estudiante_id: o.est, sala_id: o.sala ?? 5, tipo_id: o.tipo,
    estado_id: o.estado ?? (desaprueba.length ? "D" : "A"),
    fecha_creacion: new Date(o.fecha ?? (o.tipo === "inicial" ? "2025-04-01T12:00:00Z" : "2025-11-01T12:00:00Z")),
    estudiantes: { personas: { nombre: o.nombre ?? "Ana", primer_apellido: o.apellido ?? o.est.toUpperCase(), segundo_apellido: o.apellido2 ?? null } },
    evaluaciones_estudiante_area: areas,
  };
}

/** Una sub-pregunta respondida de una pauta. */
export function mkResp(o: {
  eval: string; area: string; pregunta: string; numero: number | null; respuesta: number | null;
  invertida?: boolean; activa?: boolean | null; titulo?: string | null; consigna?: string | null;
}): RespuestaReporteRow {
  return {
    respuesta: o.respuesta,
    evaluaciones_estudiante_area: { evaluacion_estudiante_id: o.eval, area_id: o.area },
    preguntas: {
      id: o.pregunta, numero: o.numero, activa: o.activa === undefined ? true : o.activa,
      puntaje_invertido: o.invertida ?? false, titulo: o.titulo ?? null, consigna: o.consigna ?? `Consigna ${o.numero}`,
    },
  };
}

export function mkInput(
  evaluaciones: EvaluacionReporteRow[],
  respuestas: RespuestaReporteRow[] = [],
  periodo = 2025,
  turno: string | null = null,
  turnos: string[] = [],
): ReporteInput {
  return { escuela: ESCUELA, periodo, generadoEn: GENERADO, catalogos: CATALOGOS, evaluaciones, respuestas, turno, turnos };
}
