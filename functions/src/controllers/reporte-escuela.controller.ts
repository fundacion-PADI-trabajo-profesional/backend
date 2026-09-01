import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { commonResponse } from "../interfaces/common-response.interface";
import { ReporteEscuelaService } from "../services/reporte-escuela.service";
import { AuthorizationError } from "../utils/errors";

const service = new ReporteEscuelaService();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /reportes/escuela?escuela_id=<uuid>&periodo=<año>
 * Reporte de escuela para el PDF. Solo `equipo_padi`.
 * @returns 200 con `ReporteEscuela`; 400 parámetros inválidos; 403 sin permiso; 404 escuela inexistente.
 */
export async function getReporteEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const escuelaId = String(req.query.escuela_id ?? "");
    const periodo = parseInt(String(req.query.periodo ?? ""), 10);
    if (!UUID_RE.test(escuelaId) || isNaN(periodo) || periodo < 2000 || periodo > 2100) {
      return res.status(400).json(commonResponse(false, "Parámetros inválidos: se requieren escuela_id (uuid) y periodo (año)", null));
    }

    const data = await service.getReporteEscuela({ escuelaId, periodo, rol: String(req.user!.rol) });
    if (!data) return res.status(404).json(commonResponse(false, "Escuela no encontrada", null));

    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return res.status(403).json(commonResponse(false, error.message, null));
    }
    return res.status(500).json(commonResponse(false, "Error interno del servidor", null));
  }
}
