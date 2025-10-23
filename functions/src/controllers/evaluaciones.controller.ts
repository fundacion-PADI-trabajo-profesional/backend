import { Request, Response } from "express";
import { EvaluacionesService } from "../services/evaluaciones.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new EvaluacionesService();

export async function listEvaluaciones(_req: Request, res: Response) {
  const data = await service.list();
  res.status(200).json(commonResponse(true, "ok", data));
}


