import { Request, Response } from "express";
import { HealthService } from "../services/health.service";
import { commonResponse } from "../interfaces/common-response.interface";

const healthService = new HealthService();

/**
 * Verifica la conectividad con la base de datos (health check general).
 *
 * @remarks
 * Realiza una consulta simple a la DB. Usado por sistemas de monitoreo externos.
 * Para probes de Kubernetes/Cloud Run preferir `getLivez` y `getReadyz`.
 *
 * `GET /health`
 *
 * @param _req - No se usa.
 * @param res - `200` si la DB responde, `503` si la conexión falla.
 */
export async function getHealth(_req: Request, res: Response) {
  try {
    await healthService.getHealth();
    res.status(200).json(commonResponse(true, "OK: Database connection is healthy.", null));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Health check failed:", message);
    res.status(503).json(commonResponse(false, "Service Unavailable: Database connection failed.", null));
  }
}

/**
 * Liveness probe: confirma que el proceso Node.js está vivo.
 *
 * @remarks
 * No realiza ninguna operación de I/O. Responde de forma instantánea.
 * Usado por el orquestador (Firebase / Cloud Run) para determinar si debe
 * reiniciar la instancia.
 *
 * `GET /livez`
 *
 * @param _req - No se usa.
 * @param res - Siempre `200 OK`.
 */
export function getLivez(_req: Request, res: Response) {
  res.status(200).json(commonResponse(true, "OK", null));
}

/**
 * Readiness probe: confirma que la aplicación está lista para recibir tráfico.
 *
 * @remarks
 * A diferencia de {@link getLivez}, este endpoint verifica que la base de datos
 * sea accesible. Si la DB no responde, devuelve `503` para que el orquestador
 * deje de enviar tráfico a esta instancia hasta que se recupere.
 *
 * `GET /readyz`
 *
 * @param _req - No se usa.
 * @param res - `200` si la DB está accesible, `503` si no lo está.
 */
export async function getReadyz(_req: Request, res: Response) {
  try {
    await healthService.getHealth();
    res.status(200).json(commonResponse(true, "OK: Ready to serve traffic.", null));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[readyz] DB not ready:", message);
    res.status(503).json(commonResponse(false, "Service Unavailable: Database not ready.", null));
  }
}
