import { withRLSContext } from "../config/prismaClient";
import type { EvaluacionReporteRow, RespuestaReporteRow, CatalogosReporte } from "../interfaces/reporte-escuela.interface";

// Mismo tope que las consultas de estadísticas: si se supera, se falla en vez de calcular sobre datos incompletos.
const MAX_EVALUACIONES_POR_QUERY = 50_000;
// Las respuestas se piden por lotes de evaluaciones para no armar un IN gigante.
const LOTE_EVALUACIONES = 100;

/**
 * Consultas del reporte de escuela. Todas corren bajo RLS (`withRLSContext`).
 * Se exporta como objeto literal para poder espiarlo con `vi.spyOn` en los tests.
 */
export const ReporteEscuelaRepository = {
  /** Escuela por id, o `null` si no existe (o RLS no la deja ver). */
  async findEscuela(escuelaId: string): Promise<{ id: string; nombre: string } | null> {
    return withRLSContext((tx) =>
      tx.escuelas.findUnique({ where: { id: escuelaId }, select: { id: true, nombre: true } })
    );
  },

  /** Catálogos de salas y áreas (áreas ordenadas por `orden`). */
  async findCatalogos(): Promise<CatalogosReporte> {
    return withRLSContext(async (tx) => {
      const [salas, areas] = await Promise.all([
        tx.salas.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }),
        tx.areas.findMany({ select: { id: true, nombre: true, orden: true }, orderBy: { orden: "asc" } }),
      ]);
      return { salas, areas };
    });
  },

  /**
   * Evaluaciones terminadas (A/D) de los estudiantes de la escuela dentro del período,
   * con persona y estado por área.
   */
  async findEvaluacionesTerminadas(f: { escuelaId: string; periodoStart: Date; periodoEnd: Date }): Promise<EvaluacionReporteRow[]> {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
        where: {
          estado_id: { in: ["A", "D"] },
          fecha_creacion: { gte: f.periodoStart, lt: f.periodoEnd },
          estudiantes: { is: { escuela_id: f.escuelaId } },
        },
        select: {
          id: true, estudiante_id: true, sala_id: true, tipo_id: true, estado_id: true, fecha_creacion: true,
          estudiantes: { select: { personas: { select: { nombre: true, primer_apellido: true, segundo_apellido: true } } } },
          evaluaciones_estudiante_area: { select: { area_id: true, estado_id: true } },
        },
        orderBy: { fecha_creacion: "asc" },
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });
      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(`La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones para la escuela.`);
      }
      return rows;
    });
  },

  /**
   * Respuestas por sub-pregunta de las áreas terminadas (A/D) de las evaluaciones dadas,
   * con los metadatos de la pregunta necesarios para agrupar por pauta.
   */
  async findRespuestas(f: { evaluacionIds: string[] }): Promise<RespuestaReporteRow[]> {
    return withRLSContext(async (tx) => {
      const out: RespuestaReporteRow[] = [];
      for (let i = 0; i < f.evaluacionIds.length; i += LOTE_EVALUACIONES) {
        const lote = f.evaluacionIds.slice(i, i + LOTE_EVALUACIONES);
        const rows = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
          where: {
            evaluaciones_estudiante_area: { evaluacion_estudiante_id: { in: lote }, estado_id: { in: ["A", "D"] } },
          },
          select: {
            respuesta: true,
            evaluaciones_estudiante_area: { select: { evaluacion_estudiante_id: true, area_id: true } },
            preguntas: { select: { id: true, numero: true, activa: true, puntaje_invertido: true, titulo: true, consigna: true } },
          },
        });
        out.push(...rows);
      }
      return out;
    });
  },
};
