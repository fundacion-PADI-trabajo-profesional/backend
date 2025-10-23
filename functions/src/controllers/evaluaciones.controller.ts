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


