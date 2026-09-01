import { ReporteEscuelaRepository } from "../repositories/reporte-escuela.repository";
import { buildReporteEscuela } from "./reporte-escuela.calc";
import { getPeriodoRange } from "../utils/periodo";
import { AuthorizationError } from "../utils/errors";
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
   * @returns el reporte, o `null` si la escuela no existe.
   */
  async getReporteEscuela(params: { escuelaId: string; periodo: number; rol: string }): Promise<ReporteEscuela | null> {
    this.validateRol(params.rol, "equipo_padi");

    const escuela = await this.repo.findEscuela(params.escuelaId);
    if (!escuela) return null;

    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [catalogos, evaluaciones] = await Promise.all([
      this.repo.findCatalogos(),
      this.repo.findEvaluacionesTerminadas({ escuelaId: params.escuelaId, periodoStart, periodoEnd }),
    ]);
    const respuestas = evaluaciones.length > 0
      ? await this.repo.findRespuestas({ evaluacionIds: evaluaciones.map((e) => e.id) })
      : [];

    return buildReporteEscuela({ escuela, periodo: params.periodo, generadoEn: new Date(), catalogos, evaluaciones, respuestas });
  }
}
