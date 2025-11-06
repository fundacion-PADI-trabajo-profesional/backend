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
  try { // <--- Añadir try
    const data = await service.listInstancias();
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error) { // <--- Añadir catch
    const message = error instanceof Error ? error.message : String(error);
    console.error("ERROR en listEvaluacionesInstancias:", error); // <-- ¡Verías esto!
    res.status(500).json(commonResponse(false, "internal_error", null, { code: "INTERNAL_ERROR", description: message }));
  }
}

export async function getEvaluacionInstanciaById(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const data = await service.getInstanciaById(id);
  if (!data) return res.status(404).json(commonResponse(false, "not found", null, { code: "NOT_FOUND" }));
  res.status(200).json(commonResponse(true, "ok", data));
}

export async function createEvaluacionInstancia(req: Request, res: Response) {
  try {
    const { estudianteId, salaId, tipoId, estadoId, puntaje } = req.body ?? {};
    if (!estudianteId || !salaId || !tipoId || !estadoId) {
      return res.status(400).json(commonResponse(false, "validation_error", null, { code: "VALIDATION_ERROR" }));
    }

    // Convierte 'puntaje' a número o null.
    // Esto maneja "", null, undefined, y "90".
    const puntajeAsNumber = (puntaje !== null && puntaje !== undefined && puntaje !== "")
      ? Number(puntaje)
      : null;

    // Validación extra: si no es nulo, asegúrate de que sea un número válido
    if (puntajeAsNumber !== null && isNaN(puntajeAsNumber)) {
      return res.status(400).json(commonResponse(false, "validation_error", null, { code: "INVALID_PUNTAJE", description: "El puntaje debe ser un número válido" }));
    }

    const data = await service.createInstancia({ estudianteId, salaId: Number(salaId), tipoId, estadoId, puntaje: puntajeAsNumber });
    res.status(201).json(commonResponse(true, "ok", data));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json(commonResponse(false, "internal_error", null, { code: "INTERNAL_ERROR", description: message }));
  }
}

export async function actualizarEvaluacionInstancia(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { estudianteId, salaId, tipoId, estadoId, puntaje } = req.body ?? {};

    const puntajeAsNumber = (puntaje !== null && puntaje !== undefined && puntaje !== "")
      ? Number(puntaje)
      : null;

    if (puntajeAsNumber !== null && isNaN(puntajeAsNumber)) {
      return res.status(400).json(commonResponse(false, "validation_error", null, { code: "INVALID_PUNTAJE", description: "El puntaje debe ser un número válido" }));
    }

    const data = await service.actualizarInstancia(id, {
      estudianteId,
      salaId: salaId !== undefined ? Number(salaId) : undefined,
      tipoId,
      estadoId,
      puntaje: puntajeAsNumber,
    });

    if (!data) {
      return res.status(404).json(commonResponse(false, "not_found", null, { code: "NOT_FOUND" }));
    }
    
    res.status(200).json(commonResponse(true, "ok", data));

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json(commonResponse(false, "internal_error", null, { code: "INTERNAL_ERROR", description: message }));
  }
}

export async function eliminarEvaluacionInstancia(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    
    const data = await service.eliminarInstancia(id);

    if (!data) {
      return res.status(404).json(commonResponse(false, "not_found", null, { code: "NOT_FOUND" }));
    }

    res.status(204).send(); 

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json(commonResponse(false, "internal_error", null, { code: "INTERNAL_ERROR", description: message }));
  }
}


