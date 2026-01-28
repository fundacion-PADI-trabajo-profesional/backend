import { Request, Response } from "express";
import { EvaluacionService } from "../services/evaluaciones.service";

const service = new EvaluacionService();

export const createEvaluacion = async (req: Request, res: Response) => {
  try {
    const data = await service.createEvaluacion(req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getEvaluaciones = async (req: Request, res: Response) => {
  try {
    const { profesorId } = req.query;
    const data = await service.getListByDocente(profesorId as string);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEvaluacionById = async (req: Request, res: Response) => {
  try {
    const data = await service.getDetalle(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const deleteEvaluacion = async (req: Request, res: Response) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, message: "Evaluación eliminada" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};