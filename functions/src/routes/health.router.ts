import { Router } from "express";
import { getHealth, getLivez, getReadyz } from "../controllers/health.controller";

/**
 * Crea el router de health-check (rutas públicas, sin autenticación).
 *
 * @remarks
 * Expone tres endpoints para verificar la salud del sistema:
 * - `GET /health` — estado general del servicio y la base de datos.
 * - `GET /livez` — liveness probe: confirma que el proceso está vivo.
 * - `GET /readyz` — readiness probe: confirma que el servicio puede recibir tráfico.
 *
 * @returns Router de Express configurado con las rutas de health.
 */
export function createHealthRouter() {
  const router = Router();
  router.get("/health", getHealth);
  router.get("/livez", getLivez);
  router.get("/readyz", getReadyz);
  return router;
}
