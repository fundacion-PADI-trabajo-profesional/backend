import type { Request, Response } from "express";
import { DocentesService } from "../services/docentes.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const service = new DocentesService();

/**
 * Lista los docentes del sistema según el rol del usuario autenticado.
 *
 * @remarks
 * El alcance del listado depende del rol: un admin ve todos los docentes,
 * un director solo ve los de su escuela. La identidad del solicitante
 * se obtiene del token JWT verificado por el middleware, nunca de query params.
 *
 * `GET /docentes`
 *
 * @param req - Request autenticado. Sin parámetros adicionales.
 * @param res - `200` con el array de docentes, `403` sin permisos, `500` error interno.
 */
export async function listDocentes(req: AuthenticatedRequest, res: Response) {
  try {
    // ANTES: const { usuario_id, rol } = req.query;
    // AHORA: datos verificados del middleware
    const data = await service.list({
      id: req.user!.id,
      rol: req.user!.rol,
    });
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error?.message || "Error interno al listar docentes";
    const status = message.includes("No tienes permisos") ? 403 : 500;
    res.status(status).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
  }
}

/**
 * Asigna un docente a una escuela.
 *
 * `POST /docentes/:id/asignar-escuela`
 *
 * @param req - Request autenticado. Param: `id` del docente. Body: `{ escuela_id }`.
 * @param res - `200` con la relación creada, `400` si la asignación falla.
 */
export async function assignDocenteEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { escuela_id } = req.body;

    const data = await service.assignEscuela(String(id), String(escuela_id), {
      id: req.user!.id,
      rol: req.user!.rol,
    });

    if (!id || !escuela_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
            description: "id, escuela_id, usuario_id y rol son obligatorios",
          }),
        );
    }

    res.status(200).json(commonResponse(true, "Docente asignado al colegio", data));
  } catch (error: any) {
    const message = error?.message || "Error al asignar docente al colegio";
    res.status(400).json(commonResponse(false, message, null, { code: "ASSIGN_ERROR", description: message }));
  }
}

/**
 * Desasigna un docente de una escuela.
 *
 * `POST /docentes/:id/desasignar-escuela`
 *
 * @param req - Request autenticado. Param: `id` del docente. Body: `{ escuela_id }`.
 * @param res - `200` si fue desasignado, `400` si la operación falla.
 */
export async function unassignDocenteEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { escuela_id, } = req.body;

    const data = await service.unassignEscuela(String(id), String(escuela_id), {
      id: req.user!.id,
      rol: req.user!.rol,
    });

    if (!id || !escuela_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
            description: "id, escuela_id, usuario_id y rol son obligatorios",
          }),
        );
    }


    res.status(200).json(commonResponse(true, "Docente desasignado del colegio", null));
  } catch (error: any) {
    const message = error?.message || "Error al desasignar docente del colegio";
    res.status(400).json(commonResponse(false, message, null, { code: "UNASSIGN_ERROR", description: message }));
  }
}
