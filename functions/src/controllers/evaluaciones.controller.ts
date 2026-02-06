import { Request, Response } from "express";
import { EvaluacionService } from "../services/evaluaciones.service";
import { commonResponse } from "../interfaces/common-response.interface";


const service = new EvaluacionService();

export async function createEvaluacion(req: Request, res: Response) {
  try {
    const data = await service.createEvaluacion(req.body);
    res.status(201).json(commonResponse(true, "Evaluación creada con éxito", data));
  } catch (error: any) {
    const message = error.message || "Error al crear evaluación";
    res.status(400).json(commonResponse(false, message, null, { code: "CREATE_ERROR" }));
  }
}

// export async function getEvaluaciones(req: Request, res: Response) {
//   try {
//     const { profesorId } = req.query;
//     if (!profesorId) {
//       return res.status(400).json(commonResponse(false, "Falta profesorId", null));
//     }
//     const data = await service.getListByDocente(String(profesorId));
//     res.status(200).json(commonResponse(true, "ok", data));
//   } catch (error: any) {
//     res.status(500).json(commonResponse(false, error.message, null));
//   }
// }

export async function getEvaluaciones(req: Request, res: Response) {
  try {
    const { escuela_id, rol } = req.query; // Extraemos filtros de la query
    let data;

    // Si es docente o director, filtramos por su escuela asignada
    if ((rol === "docente" || rol === "director") && escuela_id) {
      data = await service.listByEscuela(String(escuela_id));
    } else if ((rol === "docente" || rol === "director") && !escuela_id) {
      return res.status(400).json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
    } else {
      // Usuarios admin ven todo el listado
      data = await service.list();
    }

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(500).json(commonResponse(false, error.message, null, { code: "INTERNAL_ERROR" }));
  }
}

export async function getEvaluacionById(req: Request, res: Response) {
  try {
    const data = await service.getDetalle(req.params.id);
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(404).json(commonResponse(false, "Evaluación no encontrada", null));
  }
}

export async function deleteEvaluacion(req: Request, res: Response) {
  try {
    await service.remove(req.params.id);
    res.status(200).json(commonResponse(true, "Evaluación eliminada", null));
  } catch (error: any) {
    res.status(500).json(commonResponse(false, error.message, null));
  }
}

export async function getPreguntasDeArea(req: Request, res: Response) {
  try {
    const { id, areaId } = req.params;
    const data = await service.getPreguntasArea(id, areaId);
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(400).json(commonResponse(false, error.message, null));
  }
}

export async function guardarRespuestasArea(req: Request, res: Response) {
  try {
    const { id } = req.params; // evaluacionId
    const { areaId, questions } = req.body;

    await service.guardarRespuestas(id, areaId, questions);
    res.status(200).json(commonResponse(true, "ok", null));
  } catch (error: any) {
    res.status(400).json(commonResponse(false, error.message, null));
  }
}