import { ReporteEscuelaRepository } from "../repositories/reporte-escuela.repository";
import { buildReporteEscuela } from "./reporte-escuela.calc";
import { getPeriodoRange } from "../utils/periodo";
import { AuthorizationError } from "../utils/errors";
import { normalizarTurno, TURNOS, type Turno } from "../utils/turno";
import type { ReporteEscuela } from "../interfaces/reporte-escuela.interface";

/**
 * Reporte de escuela en PDF (spec `feature-reporte-escuela/spec.md`).
 * Solo `equipo_padi`. El cálculo vive en `buildReporteEscuela` (puro); acá solo se valida y se consulta.
 */
export class ReporteEscuelaService {
  private repo = ReporteEscuelaRepository;

  private validateRol(rol: string, ...rolesPermitidos: string[]) {
    if (!rolesPermitidos.includes(rol)) throw new AuthorizationError("Acceso denegado");
  }

  /**
   * Reporte completo de una escuela para un año (los tres modos, resumen y salas).
   * `turno`, si se pasa, filtra las evaluaciones a las de aulas con ese turno canónico.
   * Los turnos se guardan como texto libre en la base; para tolerar variantes (mayúsculas,
   * acentos, sinónimos de "completo"), se agrupan los valores crudos por turno canónico
   * (`normalizarTurno`) y el filtro se expande a todas las variantes crudas de ese canónico.
   * @returns el reporte, o `null` si la escuela no existe.
   */
  async getReporteEscuela(params: { escuelaId: string; periodo: number; rol: string; turno?: string | null }): Promise<ReporteEscuela | null> {
    this.validateRol(params.rol, "equipo_padi");

    const escuela = await this.repo.findEscuela(params.escuelaId);
    if (!escuela) return null;

    // El controlador ya normalizó `turno` a un valor canónico (o null); lo tratamos como tal.
    const turno = (params.turno ?? null) as Turno | null;
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);

    const [catalogos, turnosCrudos] = await Promise.all([
      this.repo.findCatalogos(),
      this.repo.findTurnosCrudos({ escuelaId: params.escuelaId, periodoStart, periodoEnd }),
    ]);

    // Agrupamos los turnos crudos por su turno canónico. Un valor crudo que no matchea ningún
    // turno conocido (normalizarTurno devuelve null) se ignora del todo: no aparece en el
    // catálogo `turnos` de la respuesta ni puede matchearse por ningún filtro.
    const canonicosPresentes = new Set<Turno>();
    const variantesPorCanonico = new Map<Turno, string[]>();
    for (const crudo of turnosCrudos) {
      const canonico = normalizarTurno(crudo);
      if (!canonico) continue;
      canonicosPresentes.add(canonico);
      const variantes = variantesPorCanonico.get(canonico) ?? [];
      variantes.push(crudo);
      variantesPorCanonico.set(canonico, variantes);
    }
    const turnos = TURNOS.filter((t) => canonicosPresentes.has(t));

    const evaluaciones = await this.repo.findEvaluacionesTerminadas({
      escuelaId: params.escuelaId,
      periodoStart,
      periodoEnd,
      // Si el canónico pedido no tiene ninguna variante cruda en esta escuela+período,
      // se filtra con un array vacío: la consulta no devuelve nada, lo cual es correcto.
      ...(turno !== null ? { turnos: variantesPorCanonico.get(turno) ?? [] } : {}),
    });

    const respuestas = evaluaciones.length > 0
      ? await this.repo.findRespuestas({ evaluacionIds: evaluaciones.map((e) => e.id) })
      : [];

    return buildReporteEscuela({ escuela, periodo: params.periodo, generadoEn: new Date(), catalogos, evaluaciones, respuestas, turno, turnos });
  }
}
