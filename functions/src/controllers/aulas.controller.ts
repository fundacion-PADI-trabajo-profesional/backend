import type { Request, Response } from "express";
import { AulasService } from "../services/aulas.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const service = new AulasService();

// POST /aulas
export async function createAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { sala_id, turno, escuela_id } = req.body;
    const comision = req.body.comision || "Única";

    if (!sala_id || !turno) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };
    const data = await service.create(
      {
        sala_id: Number(sala_id),
        comision,
        turno,
        escuela_id: escuela_id ? String(escuela_id) : undefined,
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
export async function listAulas(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

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
export async function updateAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { sala_id, comision, turno } = req.body;

    if (!id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

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
export async function deleteAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

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

// GET /aulas/:id/docentes
export async function listAulaDocentes(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.listDocentes(id, user);

    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error.message || "Error interno al listar docentes del aula";
    console.error("[listAulaDocentes] Error:", error);

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

// POST /aulas/:id/asignar-docente
export async function asignarDocenteAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { profesor_id } = req.body;

    if (!id || !profesor_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.asignarDocente(id, String(profesor_id), user);

    return res
      .status(200)
      .json(commonResponse(true, "Docente asignado al aula", data));
  } catch (error: any) {
    const message = error.message || "Error al asignar docente al aula";
    console.error("[asignarDocenteAula] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "ASSIGN_ERROR",
          description: message,
        }),
      );
  }
}

// POST /aulas/:id/desasignar-docente
export async function desasignarDocenteAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { profesor_id } = req.body;

    if (!id || !profesor_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

    await service.desasignarDocente(id, String(profesor_id), user);

    return res
      .status(200)
      .json(commonResponse(true, "Docente desasignado del aula", null));
  } catch (error: any) {
    const message = error.message || "Error al desasignar docente del aula";
    console.error("[desasignarDocenteAula] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "UNASSIGN_ERROR",
          description: message,
        }),
      );
  }
}

// GET /docentes/aulas
export async function listDocenteAulas(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.listDocenteAulas(user);
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error.message || "Error al obtener aulas del docente";
    console.error("[listDocenteAulas] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "LIST_ERROR",
          description: message,
        }),
      );
  }
}

// POST /aulas/:id/asignar-estudiante
export async function asignarEstudianteAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { estudiante_id } = req.body;

    if (!id || !estudiante_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };
    const data = await service.asignarEstudiante(id, String(estudiante_id), user);

    return res
      .status(200)
      .json(commonResponse(true, "Estudiante asignado al aula", data));
  } catch (error: any) {
    const message = error.message || "Error al asignar estudiante al aula";
    console.error("[asignarEstudianteAula] Error:", error);
    return res
      .status(400)
      .json(commonResponse(false, message, null, { code: "ASSIGN_ERROR", description: message }));
  }
}

// POST /aulas/:id/desasignar-estudiante
export async function desasignarEstudianteAula(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { estudiante_id } = req.body;

    if (!id || !estudiante_id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };
    await service.desasignarEstudiante(id, String(estudiante_id), user);

    return res
      .status(200)
      .json(commonResponse(true, "Estudiante desasignado del aula", null));
  } catch (error: any) {
    const message = error.message || "Error al desasignar estudiante del aula";
    console.error("[desasignarEstudianteAula] Error:", error);
    return res
      .status(400)
      .json(commonResponse(false, message, null, { code: "UNASSIGN_ERROR", description: message }));
  }
}

// GET /aulas/:id/estudiantes
export async function listAulaEstudiantes(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;


    if (!id) {
      return res
        .status(400)
        .json(
          commonResponse(false, "Faltan datos obligatorios", null, {
            code: "VALIDATION_ERROR",
          }),
        );
    }

    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.listEstudiantesAula(id, user);
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const message = error.message || "Error al obtener estudiantes del aula";
    console.error("[listAulaEstudiantes] Error:", error);

    return res
      .status(400)
      .json(
        commonResponse(false, message, null, {
          code: "LIST_ERROR",
          description: message,
        }),
      );
  }
}


