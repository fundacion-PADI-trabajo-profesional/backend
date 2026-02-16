import type { Request, Response } from "express";
import { DocentesService } from "../services/docentes.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new DocentesService();

export async function listDocentes(req: Request, res: Response) {
  try {
    const { usuario_id, rol } = req.query;
    if (!usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos de usuario", null, {
            code: "VALIDATION_ERROR",
            description: "usuario_id y rol son obligatorios",
          }),
        );
    }

    const data = await service.list({ id: String(usuario_id), rol: String(rol) });
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error?.message || "Error interno al listar docentes";
    const status = message.includes("No tienes permisos") ? 403 : 500;
    res.status(status).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
  }
}

export async function assignDocenteEscuela(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { escuela_id, usuario_id, rol } = req.body;
    if (!id || !escuela_id || !usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
            description: "id, escuela_id, usuario_id y rol son obligatorios",
          }),
        );
    }

    const data = await service.assignEscuela(String(id), String(escuela_id), {
      id: String(usuario_id),
      rol: String(rol),
    });

    res.status(200).json(commonResponse(true, "Docente asignado al colegio", data));
  } catch (error: any) {
    const message = error?.message || "Error al asignar docente al colegio";
    res.status(400).json(commonResponse(false, message, null, { code: "ASSIGN_ERROR", description: message }));
  }
}

export async function unassignDocenteEscuela(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { escuela_id, usuario_id, rol } = req.body;
    if (!id || !escuela_id || !usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
            description: "id, escuela_id, usuario_id y rol son obligatorios",
          }),
        );
    }

    await service.unassignEscuela(String(id), String(escuela_id), {
      id: String(usuario_id),
      rol: String(rol),
    });

    res.status(200).json(commonResponse(true, "Docente desasignado del colegio", null));
  } catch (error: any) {
    const message = error?.message || "Error al desasignar docente del colegio";
    res.status(400).json(commonResponse(false, message, null, { code: "UNASSIGN_ERROR", description: message }));
  }
}
