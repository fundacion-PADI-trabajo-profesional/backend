import { Request, Response } from "express";
import { HealthService } from "../services/health.service";
import { commonResponse } from "../interfaces/common-response.interface";

const healthService = new HealthService();

// Controlador HTTP: llama al servicio y formatea la response.

export async function getHealth(_req: Request, res: Response) {
  try {
    await healthService.getHealth();

    //si wait healthService no lanza error, la conexión es exitosa.
    res.status(200).json(commonResponse(true, "OK: Database connection is healthy.", null));

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Health check failed:", message);

    //standar response code for unavailable service.
    res.status(503).json(commonResponse(false, "Service Unavailable: Database connection failed.", null));
  }
}