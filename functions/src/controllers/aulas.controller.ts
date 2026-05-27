import type { Response } from "express";
import { AulasService } from "../services/aulas.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const service = new AulasService();

/**
 * Crea un nuevo aula en el sistema.
 *
 * `POST /aulas`
 *
 * @param req - Request autenticado. Body: `{ sala_id, turno, escuela_id, comision? }`. `comision` por defecto es `"Única"`.
 * @param res - `201` con el aula creada, `400` si faltan `sala_id` o `turno`.
 */
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

/**
 * Lista las aulas accesibles para el usuario autenticado.
 *
 * @remarks
 * El servicio filtra el resultado según el rol: un docente solo ve sus aulas asignadas,
 * un director solo las de su escuela, un administrador (Equipo Padi) ve todas.
 *
 * `GET /aulas`
 *
 * @param req - Request autenticado. Sin parámetros adicionales.
 * @param res - `200` con el array de aulas, `500` si ocurre un error interno.
 */
export async function listAulas(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };
    const escuela_id = req.query.escuela_id ? String(req.query.escuela_id) : undefined;

    const data = await service.list(user, escuela_id);
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

/**
 * Actualiza los datos de un aula existente.
 *
 * `PUT /aulas/:id`
 *
 * @param req - Request autenticado. Param: `id`. Body: `{ sala_id?, comision?, turno? }`.
 * @param res - `200` con el aula actualizada, `400` si falta el ID o la actualización falla.
 */
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

/**
 * Elimina un aula del sistema.
 *
 * `DELETE /aulas/:id`
 *
 * @param req - Request autenticado. Param: `id` del aula.
 * @param res - `200` si fue eliminada, `400` si falta el ID o la eliminación falla.
 */
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

/**
 * Lista los docentes asignados a un aula específica.
 *
 * `GET /aulas/:id/docentes`
 *
 * @param req - Request autenticado. Param: `id` del aula.
 * @param res - `200` con el array de docentes, `400` si falta el ID, `500` error interno.
 */
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

/**
 * Asigna un docente a un aula.
 *
 * `POST /aulas/:id/asignar-docente`
 *
 * @param req - Request autenticado. Param: `id` del aula. Body: `{ profesor_id }`.
 * @param res - `200` con la relación creada, `400` si faltan datos o la asignación falla.
 */
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

/**
 * Desasigna un docente de un aula.
 *
 * `POST /aulas/:id/desasignar-docente`
 *
 * @param req - Request autenticado. Param: `id` del aula. Body: `{ profesor_id }`.
 * @param res - `200` si fue desasignado, `400` si faltan datos o la operación falla.
 */
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

/**
 * Lista las aulas asignadas al docente autenticado.
 *
 * `GET /docentes/aulas`
 *
 * @param req - Request autenticado con rol `docente`.
 * @param res - `200` con el array de aulas del docente, `400` si la consulta falla.
 */
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

/**
 * Asigna un estudiante a un aula.
 *
 * `POST /aulas/:id/asignar-estudiante`
 *
 * @param req - Request autenticado. Param: `id` del aula. Body: `{ estudiante_id }`.
 * @param res - `200` con la relación creada, `400` si faltan datos o la asignación falla.
 */
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

/**
 * Desasigna un estudiante de un aula.
 *
 * `POST /aulas/:id/desasignar-estudiante`
 *
 * @param req - Request autenticado. Param: `id` del aula. Body: `{ estudiante_id }`.
 * @param res - `200` si fue desasignado, `400` si faltan datos o la operación falla.
 */
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

/**
 * Lista los estudiantes asignados a un aula específica.
 *
 * `GET /aulas/:id/estudiantes`
 *
 * @param req - Request autenticado. Param: `id` del aula.
 * @param res - `200` con el array de estudiantes, `400` si falta el ID, `400` si falla.
 */
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


