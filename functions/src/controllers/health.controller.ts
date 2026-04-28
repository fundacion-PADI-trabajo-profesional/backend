import { Request, Response } from "express";
import { HealthService } from "../services/health.service";
import { commonResponse } from "../interfaces/common-response.interface";

const healthService = new HealthService();

// Controlador HTTP: llama al servicio y formatea la response.

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

// Liveness: el proceso esta vivo. No toca la DB -- respuesta instantanea.
export function getLivez(_req: Request, res: Response) {
  res.status(200).json(commonResponse(true, "OK", null));
}

// Readiness: la app esta lista para recibir trafico (DB accesible).
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
