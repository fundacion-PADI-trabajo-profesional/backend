import type { Request, Response } from "express";
import { AulasService } from "../services/aulas.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new AulasService();

// POST /aulas
export async function createAula(req: Request, res: Response) {
  try {
    const { sala_id, comision, turno, usuario_id, rol } = req.body;

    if (!sala_id || !comision || !turno || !usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = {
      id: String(usuario_id),
      rol: String(rol),
    };

    const data = await service.create(
      {
        sala_id: Number(sala_id),
        comision,
        turno,
      },
      user,
    );

    return res
      .status(201)
      .json(commonResponse(true, "Aula creada con éxito", data));
  } catch (error: any) {
    const message = error.message || "Error interno al crear aula";
    console.error("[createAula] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "CREATE_ERROR",
          description: message,
        }),
      );
  }
}

// GET /aulas
export async function listAulas(req: Request, res: Response) {
  try {
    const { usuario_id, rol } = req.query;

    if (!usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos de usuario", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = {
      id: String(usuario_id),
      rol: String(rol),
    };

    const data = await service.list(user);

    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error.message || "Error interno al listar aulas";
    console.error("[listAulas] Error:", error);

    return res
      .status(500)
      .json(
        commonResponse(false, message, null, {
          code: "INTERNAL_ERROR",
          description: message,
        }),
      );
  }
}

// PUT /aulas/:id
export async function updateAula(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { sala_id, comision, turno, usuario_id, rol } = req.body;

    if (!id || !usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = {
      id: String(usuario_id),
      rol: String(rol),
    };

    const data = await service.update(
      id,
      {
        sala_id: sala_id !== undefined ? Number(sala_id) : undefined,
        comision,
        turno,
      },
      user,
    );

    return res
      .status(200)
      .json(commonResponse(true, "Aula actualizada con éxito", data));
  } catch (error: any) {
    const message = error.message || "Error interno al actualizar aula";
    console.error("[updateAula] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "UPDATE_ERROR",
          description: message,
        }),
      );
  }
}

// DELETE /aulas/:id
export async function deleteAula(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { usuario_id, rol } = req.query;

    if (!id || !usuario_id || !rol) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = {
      id: String(usuario_id),
      rol: String(rol),
    };

    await service.delete(id, user);

    return res
      .status(200)
      .json(commonResponse(true, "Aula eliminada con éxito", null));
  } catch (error: any) {
    const message = error.message || "Error interno al eliminar aula";
    console.error("[deleteAula] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "DELETE_ERROR",
          description: message,
        }),
      );
  }
}

