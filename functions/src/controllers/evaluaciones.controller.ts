import { Request, Response } from "express";
import { EvaluacionService } from "../services/evaluaciones.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { withRLSContext } from "../config/prismaClient";

const service = new EvaluacionService();

/**
 * Crea una nueva instancia de evaluación para un estudiante.
 *
 * `POST /evaluaciones`
 *
 * @param req - Request autenticado. Body: datos de la evaluación (estudiante, tipo, área, etc.).
 * @param res - `201` con la evaluación creada, `400` si la creación falla.
 */
export async function createEvaluacion(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.createEvaluacion(req.body, user);
    res.status(201).json(commonResponse(true, "Evaluación creada con éxito", data));
  } catch (error: any) {
    const message = error.message || "Error al crear evaluación";
    res.status(400).json(commonResponse(false, message, null, { code: "CREATE_ERROR" }));
  }
}

/**
 * Lista evaluaciones con filtros opcionales, aplicando restricciones por rol.
 *
 * @remarks
 * Las restricciones de acceso son estrictas:
 * - **Director**: solo ve evaluaciones de su escuela (forzado desde el token).
 * - **Encargado de zona**: solo ve evaluaciones de escuelas en su zona.
 * - **Docente**: requiere `profesorId` o `escuela_id` como filtro.
 * - **Admin**: ve todas las evaluaciones.
 *
 * `GET /evaluaciones`
 *
 * @param req - Request autenticado. Query: `estudianteId?`, `profesorId?`, `salaId?`, `tipoId?`, `estadoId?`, `escuela_id?`.
 * @param res - `200` con el array de evaluaciones filtradas, `400` si faltan filtros, `500` error interno.
 */
export async function getEvaluaciones(req: AuthenticatedRequest, res: Response) {
  try {
    const { estudianteId, profesorId, salaId, tipoId, estadoId, escuela_id } = req.query;
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;

    const filters = {
      estudianteId: typeof estudianteId === "string" ? estudianteId : undefined,
      profesorId: typeof profesorId === "string" ? profesorId : undefined,
      salaId: typeof salaId === "string" ? Number(salaId) : undefined,
      tipoId: typeof tipoId === "string" ? tipoId : undefined,
      estadoId: typeof estadoId === "string" ? estadoId : undefined,
      escuelaId: typeof escuela_id === "string" ? escuela_id : undefined,
    };

    let data;
    if (rol === "director") {
      const escuelaDirector = req.user!.escuela_id;
      if (!escuelaDirector) {
        return res
          .status(400)
          .json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
      }
      filters.escuelaId = escuelaDirector;
    }

    if (rol === "encargado_zona") {
      const encargado = await withRLSContext(async (tx) => {
        return (tx as any).encargados.findUnique({
          where: { usuario_id: userId },
          include: { zona: { include: { escuelas: { select: { id: true } } } } },
        });
      });
      const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];

      if (filters.escuelaId) {
        if (!escuelasDeZona.includes(filters.escuelaId)) {
          return res.status(403).json(commonResponse(false,
            "No tienes permisos para ver evaluaciones de esa escuela.", null));
        }
      } else {
        (filters as any).escuelaIds = escuelasDeZona;
      }
    }

    if (rol === "docente") {
      // NC2: ignorar profesorId del query y forzar siempre el propio ID para prevenir IDOR
      filters.profesorId = userId;
    }
    data = await service.listWithFilters(filters);

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(500).json(commonResponse(false, error.message, null, { code: "INTERNAL_ERROR" }));
  }
}

/**
 * Retorna el detalle completo de una evaluación por su ID, con verificación de permisos por rol.
 *
 * @remarks
 * - **Docente**: solo puede ver sus propias evaluaciones.
 * - **Director**: solo puede ver evaluaciones de su escuela.
 * - **Encargado de zona**: solo puede ver evaluaciones de escuelas en su zona.
 *
 * `GET /evaluaciones/:id`
 *
 * @param req - Request autenticado. Param: `id` de la evaluación.
 * @param res - `200` con el detalle, `403` sin permisos, `404` si no existe.
 */
export async function getEvaluacionById(req: AuthenticatedRequest, res: Response) {
  try {
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;
    const data = await service.getDetalle(req.params.id);

    //docente solo ve sus propias evaluaciones; director solo las de su escuela
    if (rol === "docente" && data.profesor_id !== userId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
    }
    if (rol === "director" && userEscuelaId) {
      const escuelaEvaluacion = (data as any).estudiantes?.escuela_id ?? (data as any).escuela_id;
      if (escuelaEvaluacion && escuelaEvaluacion !== userEscuelaId) {
        return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
      }
    }
    // Encargado de Zona: solo puede ver evaluaciones de escuelas de su zona  
    if (rol === "encargado_zona") {
      const escuelaEvaluacion = (data as any).estudiantes?.escuela_id;
      if (escuelaEvaluacion) {
        const encargado = await withRLSContext(async (tx) => {
          return (tx as any).encargados.findUnique({
            where: { usuario_id: userId },
            include: { zona: { include: { escuelas: { select: { id: true } } } } },
          });
        });
        const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];
        if (!escuelasDeZona.includes(escuelaEvaluacion)) {
          return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
        }
      }
    }

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(404).json(commonResponse(false, "Evaluación no encontrada", null));
  }
}

/**
 * Elimina una evaluación del sistema.
 *
 * `DELETE /evaluaciones/:id`
 *
 * @param req - Request autenticado. Param: `id` de la evaluación.
 * @param res - `200` si fue eliminada, `404` si no existe, `500` error interno.
 */
export async function deleteEvaluacion(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

    await service.remove(req.params.id, user);
    res.status(200).json(commonResponse(true, "Evaluación eliminada", null));
  } catch (error: any) {
    const msg = error?.message || "Error al eliminar la evaluación";
    const status = msg.includes("no existe") ? 404 : 500;
    res.status(status).json(commonResponse(false, msg, null));
  }
}

/**
 * Retorna las preguntas de un área específica dentro de una evaluación.
 *
 * `GET /evaluaciones/:id/areas/:areaId/preguntas`
 *
 * @param req - Request autenticado. Params: `id` (evaluación), `areaId`.
 * @param res - `200` con el array de preguntas, `400` si la consulta falla.
 */
export async function getPreguntasDeArea(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, areaId } = req.params;
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;

    const evaluacion = await service.getDetalle(id);
    const escuelaEvaluacion = (evaluacion as any).estudiantes?.escuela_id;

    if (rol === "docente" && evaluacion.profesor_id !== userId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
    }
    if (rol === "director" && userEscuelaId && escuelaEvaluacion && escuelaEvaluacion !== userEscuelaId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
    }
    if (rol === "encargado_zona" && escuelaEvaluacion) {
      const encargado = await withRLSContext(async (tx) => {
        return (tx as any).encargados.findUnique({
          where: { usuario_id: userId },
          include: { zona: { include: { escuelas: { select: { id: true } } } } },
        });
      });
      const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];
      if (!escuelasDeZona.includes(escuelaEvaluacion)) {
        return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
      }
    }

    const data = await service.getPreguntasArea(id, areaId);
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const status = error.message?.includes("no encontrada") ? 404 : 400;
    res.status(status).json(commonResponse(false, error.message, null));
  }
}


/**
 * Guarda las respuestas de un área de evaluación.
 *
 * `POST /evaluaciones/:id/areas/:areaId/respuestas`
 *
 * @param req - Request autenticado. Param: `id` (evaluación). Body: `{ areaId, questions }`.
 * @param res - `200` con el resultado guardado, `400` si la operación falla.
 */
export async function guardarRespuestasArea(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; //evaluacionId
    const { areaId, questions } = req.body;
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;

    const evaluacion = await service.getDetalle(id);
    const escuelaEvaluacion = (evaluacion as any).estudiantes?.escuela_id;

    if (rol === "docente" && evaluacion.profesor_id !== userId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para modificar esta evaluación.", null));
    }
    if (rol === "director" && userEscuelaId && escuelaEvaluacion && escuelaEvaluacion !== userEscuelaId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para modificar esta evaluación.", null));
    }
    if (rol === "encargado_zona" && escuelaEvaluacion) {
      const encargado = await withRLSContext(async (tx) => {
        return (tx as any).encargados.findUnique({
          where: { usuario_id: userId },
          include: { zona: { include: { escuelas: { select: { id: true } } } } },
        });
      });
      const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];
      if (!escuelasDeZona.includes(escuelaEvaluacion)) {
        return res.status(403).json(commonResponse(false, "No tienes permisos para modificar esta evaluación.", null));
      }
    }

    const data = await service.guardarRespuestas(id, areaId, questions);

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    const status = error.message?.includes("no encontrada") ? 404 : 400;
    res.status(status).json(commonResponse(false, error.message, null));
  }
}