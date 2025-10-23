import { Request, Response } from "express";
import { HealthService } from "../services/health.service";
import { commonResponse } from "../interfaces/common-response.interface";

const healthService = new HealthService();

// functions/src/controllers/health.controller.ts
// Controlador HTTP: valida/parcea la request, llama al servicio y formatea la response.
// Usa commonResponse() para respuestas consistentes.

export async function getHealth(_req: Request, res: Response) {
  await healthService.getHealth();
  res.status(200).json(commonResponse(true, "ok", null));
}


