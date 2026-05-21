import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { commonResponse } from "../interfaces/common-response.interface";
import { EstadisticasService } from "../services/estadisticas.service";
import { getEncargadoZonaId, escuelaPerteneceAZona } from "../utils/scope";

const service = new EstadisticasService();
const TIPOS_VALIDOS = ["inicial", "final"];
function parsePeriodo(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return isNaN(n) ? null : n;
}

function badParams(res: Response) {
  return res
    .status(400)
    .json(commonResponse(false, "Parámetros inválidos: se requieren periodo (año) y tipo (inicial|final)", null));
}

/**
 * Resuelve el escuela_id para los endpoints de estadísticas por escuela.
 * - Director: forzado desde el token.
 * - Encargado de zona: validado que la escuela pertenezca a su zona.
 * - PADI: cualquier escuela del query param.
 * @throws Error si encargado_zona intenta acceder a una escuela fuera de su zona.
 */
async function resolveEscuelaId(req: AuthenticatedRequest): Promise<string | null> {
  const rol = req.user!.rol;
  if (rol === "director") return req.user!.escuela_id ?? null;

  const escuelaId = req.query.escuela_id ? String(req.query.escuela_id) : null;
  if (!escuelaId) return null;

  if (rol === "encargado_zona") {
    const zonaId = await getEncargadoZonaId(req.user!.id);
    const pertenece = await escuelaPerteneceAZona(escuelaId, zonaId);
    if (!pertenece) throw new Error("No tenés permisos para ver estadísticas de esa escuela.");
  }

  return escuelaId;
}

export async function getHeatmapZonas(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);

    const data = await service.heatmapZonas({ periodo, tipo, rol: String(req.user!.rol) });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getHeatmapEscuelas(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);

    const data = await service.heatmapEscuelas({
      periodo,
      tipo,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getEvolucionPadi(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const data = await service.evolucionPadi({ periodo, rol: String(req.user!.rol) });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getEvolucionZona(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const data = await service.evolucionZona({
      periodo,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getEvolucionEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));
    const data = await service.evolucionEscuela({
      periodo,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getAreasCriticasPadi(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);
    const data = await service.areasCriticasPadi({ periodo, tipo, rol: String(req.user!.rol) });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getAreasCriticasZona(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);
    const data = await service.areasCriticasZona({
      periodo,
      tipo,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getAreasCriticasEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);
    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));
    const data = await service.areasCriticasEscuela({
      periodo,
      tipo,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getEstudiantesEnRiesgoZona(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);

    const umbralRaw = parseFloat(String(req.query.umbral ?? "0.5"));
    const umbral = isNaN(umbralRaw) || umbralRaw <= 0 || umbralRaw >= 1 ? 0.5 : umbralRaw;

    const data = await service.estudiantesEnRiesgoZona({
      periodo,
      umbral,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getEstudiantesEnRiesgoEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);

    const umbralRaw = parseFloat(String(req.query.umbral ?? "0.5"));
    const umbral = isNaN(umbralRaw) || umbralRaw <= 0 || umbralRaw >= 1 ? 0.5 : umbralRaw;

    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));

    const data = await service.estudiantesEnRiesgoEscuela({
      periodo,
      umbral,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getActividadDocentesZona(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const data = await service.actividadDocentesZona({
      periodo,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getActividadDocentesEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));
    const data = await service.actividadDocentesEscuela({
      periodo,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getCoberturaPorZona(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    if (!periodo) return badParams(res);
    const data = await service.coberturaPorZona({ periodo, rol: String(req.user!.rol) });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getComparativaEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);
    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));
    const data = await service.comparativaEscuela({
      periodo,
      tipo,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getProgresionEstudianteDocente(req: AuthenticatedRequest, res: Response) {
  try {
    const estudianteId = String(req.query.estudiante_id ?? "");
    if (!estudianteId) return badParams(res);
    const aulaId = req.query.aula_id ? String(req.query.aula_id) : undefined;
    const data = await service.progresionEstudianteDocente({
      estudianteId,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
      aulaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getProgresionEstudianteEscuela(req: AuthenticatedRequest, res: Response) {
  try {
    const estudianteId = String(req.query.estudiante_id ?? "");
    if (!estudianteId) return badParams(res);
    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));
    const data = await service.progresionEstudianteEscuela({
      estudianteId,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getAprobacionPreguntas(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const aulaId = String(req.query.aula_id ?? "");
    if (!periodo || !aulaId) return badParams(res);
    const areaId = req.query.area_id ? String(req.query.area_id) : null;
    const data = await service.aprobacionPorPregunta({
      periodo,
      aulaId,
      areaId,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getDistribucionPuntajes(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const aulaId = String(req.query.aula_id ?? "");
    if (!periodo || !aulaId) return badParams(res);
    const data = await service.distribucionPuntajesDocente({
      periodo,
      aulaId,
      rol: String(req.user!.rol),
      usuarioId: String(req.user!.id),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

export async function getHeatmapAulas(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);

    const escuelaId = await resolveEscuelaId(req);
    if (!escuelaId) return res.status(400).json(commonResponse(false, "Se requiere escuela_id", null));

    const data = await service.heatmapAulas({
      periodo,
      tipo,
      rol: String(req.user!.rol),
      escuelaId,
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}
