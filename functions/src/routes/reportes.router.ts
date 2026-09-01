import { Router } from "express";
import { getReporteEscuela } from "../controllers/reporte-escuela.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router de reportes (documentos de devolución a las escuelas).
 *
 * Rutas expuestas:
 * - `GET /reportes/escuela` — reporte completo de una escuela para un año (base del PDF). Solo `equipo_padi`.
 *
 * @returns Router de Express configurado con las rutas de reportes.
 */
export function createReportesRouter() {
  const router = Router();
  router.get("/reportes/escuela", requireRole("equipo_padi") as any, getReporteEscuela);
  return router;
}
