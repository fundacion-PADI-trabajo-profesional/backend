import { Request, Response } from "express";
import { EvaluacionesService } from "../services/evaluaciones.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new EvaluacionesService();

export async function listEvaluaciones(_req: Request, res: Response) {
  const data = await service.list();
  res.status(200).json(commonResponse(true, "ok", data));
}

export async function getEvaluacionById(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const data = await service.getById(id);
  if (!data) {
    return res
      .status(404)
      .json(commonResponse(false, "not found", null, { code: "NOT_FOUND" }));
  }
  res.status(200).json(commonResponse(true, "ok", data));
}

// ---- Instancias ----
export async function listEvaluacionesInstancias(_req: Request, res: Response) {
  const data = await service.listInstancias();
  res.status(200).json(commonResponse(true, "ok", data));
}

export async function getEvaluacionInstanciaById(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const data = await service.getInstanciaById(id);
  if (!data) return res.status(404).json(commonResponse(false, "not found", null, { code: "NOT_FOUND" }));
  res.status(200).json(commonResponse(true, "ok", data));
}

export async function createEvaluacionInstancia(req: Request, res: Response) {
  const { estudianteId, salaId, tipoId, estadoId, puntaje } = req.body ?? {};
  if (!estudianteId || !salaId || !tipoId || !estadoId) {
    return res.status(400).json(commonResponse(false, "validation_error", null, { code: "VALIDATION_ERROR" }));
  }
  const data = await service.createInstancia({ estudianteId, salaId: Number(salaId), tipoId, estadoId, puntaje });
  res.status(201).json(commonResponse(true, "ok", data));
}


