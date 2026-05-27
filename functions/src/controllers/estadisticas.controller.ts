import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { commonResponse } from "../interfaces/common-response.interface";
import { EstadisticasService } from "../services/estadisticas.service";
import { getEncargadoZonaId, escuelaPerteneceAZona } from "../utils/scope";

const service = new EstadisticasService();
const TIPOS_VALIDOS = ["inicial", "final"];

/**
 * Parsea el parámetro de período del query string y lo convierte a un entero.
 *
 * @param raw - Valor crudo proveniente del query (puede ser `undefined` u otro tipo).
 * @returns El año como número entero, o `null` si el valor no es un número válido.
 */
function parsePeriodo(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return isNaN(n) ? null : n;
}

/**
 * Envía una respuesta HTTP 400 indicando que los parámetros de la solicitud
 * son inválidos. Se usa cuando faltan `periodo` (año) o `tipo` (inicial|final).
 *
 * @param res - Objeto de respuesta de Express.
 * @returns La respuesta HTTP con estado 400 y mensaje de error.
 */
function badParams(res: Response) {
  return res
    .status(400)
    .json(commonResponse(false, "Parámetros inválidos: se requieren periodo (año) y tipo (inicial|final)", null));
}

/**
 * Resuelve el `escuela_id` para los endpoints de estadísticas por escuela,
 * aplicando la lógica de scoping según el rol del usuario:
 *
 * - **director**: devuelve el `escuela_id` forzado desde el token JWT.
 * - **encargado_zona**: lee `escuela_id` del query y valida que la escuela
 *   pertenezca a su zona; lanza un error si no pertenece.
 * - **equipo_padi**: devuelve el `escuela_id` del query sin restricciones.
 *
 * @param req - Request autenticado con información del usuario en `req.user`.
 * @returns El `escuela_id` resuelto como string, o `null` si no se encuentra.
 * @throws Error si el encargado de zona intenta acceder a una escuela fuera de su zona.
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

/**
 * Maneja la solicitud para obtener el heatmap de rendimiento por área
 * agrupado por zonas a nivel nacional.
 * Solo accesible para el rol `equipo_padi`.
 *
 * @route GET /estadisticas/heatmap/zonas
 * @queryparam periodo - Año del período (ej. 2024).
 * @queryparam tipo    - Tipo de evaluación: `"inicial"` o `"final"`.
 * @returns 200 con `HeatmapResponse`, 400 si los parámetros son inválidos,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener el heatmap de rendimiento por área
 * agrupado por escuelas dentro de la zona del encargado autenticado.
 * Solo accesible para el rol `encargado_zona`.
 *
 * @route GET /estadisticas/heatmap/escuelas
 * @queryparam periodo - Año del período.
 * @queryparam tipo    - Tipo de evaluación: `"inicial"` o `"final"`.
 * @returns 200 con `HeatmapResponse`, 400 si los parámetros son inválidos,
 *          o 403 si el rol no tiene acceso o el encargado no tiene zona asignada.
 */
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

/**
 * Maneja la solicitud para obtener la evolución nacional del rendimiento
 * por área entre la evaluación inicial y final de un período.
 * Solo accesible para el rol `equipo_padi`.
 *
 * @route GET /estadisticas/evolucion/padi
 * @queryparam periodo - Año del período.
 * @returns 200 con `EvolucionResponse`, 400 si falta el período,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener la evolución del rendimiento por área
 * en la zona del encargado autenticado.
 * Solo accesible para el rol `encargado_zona`.
 *
 * @route GET /estadisticas/evolucion/zona
 * @queryparam periodo - Año del período.
 * @returns 200 con `EvolucionResponse`, 400 si falta el período,
 *          o 403 si el rol no tiene acceso o el encargado no tiene zona asignada.
 */
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

/**
 * Maneja la solicitud para obtener la evolución del rendimiento por área
 * en una escuela específica. El `escuela_id` se resuelve automáticamente
 * según el rol del usuario (ver `resolveEscuelaId`).
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/evolucion/escuela
 * @queryparam periodo    - Año del período.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `EvolucionResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener las áreas críticas (menor rendimiento)
 * a nivel nacional. Solo accesible para el rol `equipo_padi`.
 *
 * @route GET /estadisticas/areas-criticas/padi
 * @queryparam periodo - Año del período.
 * @queryparam tipo    - Tipo de evaluación: `"inicial"` o `"final"`.
 * @returns 200 con `AreasCriticasResponse` ordenado de menor a mayor rendimiento,
 *          400 si los parámetros son inválidos, o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener las áreas críticas en la zona del
 * encargado autenticado. Solo accesible para el rol `encargado_zona`.
 *
 * @route GET /estadisticas/areas-criticas/zona
 * @queryparam periodo - Año del período.
 * @queryparam tipo    - Tipo de evaluación: `"inicial"` o `"final"`.
 * @returns 200 con `AreasCriticasResponse`, 400 si los parámetros son inválidos,
 *          o 403 si el rol no tiene acceso o el encargado no tiene zona asignada.
 */
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

/**
 * Maneja la solicitud para obtener las áreas críticas de una escuela específica.
 * El `escuela_id` se resuelve según el rol del usuario (ver `resolveEscuelaId`).
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/areas-criticas/escuela
 * @queryparam periodo    - Año del período.
 * @queryparam tipo       - Tipo de evaluación: `"inicial"` o `"final"`.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `AreasCriticasResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener los estudiantes en riesgo académico
 * en la zona del encargado autenticado.
 * Solo accesible para el rol `encargado_zona`.
 *
 * El umbral de riesgo se lee del query param `umbral` (valor entre 0 y 1,
 * exclusivo). Si es inválido, se usa el valor por defecto de `0.5`.
 *
 * @route GET /estadisticas/riesgo/zona
 * @queryparam periodo - Año del período.
 * @queryparam umbral  - (Opcional) Umbral de riesgo; por defecto `0.5`.
 * @returns 200 con `RiesgoResponse`, 400 si falta el período,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener los estudiantes en riesgo académico
 * en una escuela específica. El `escuela_id` se resuelve según el rol
 * del usuario (ver `resolveEscuelaId`).
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/riesgo/escuela
 * @queryparam periodo    - Año del período.
 * @queryparam umbral     - (Opcional) Umbral de riesgo; por defecto `0.5`.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `RiesgoResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener el ranking de actividad docente
 * (cantidad de evaluaciones registradas) en la zona del encargado.
 * Solo accesible para el rol `encargado_zona`.
 *
 * @route GET /estadisticas/actividad-docentes/zona
 * @queryparam periodo - Año del período.
 * @returns 200 con `ActividadResponse`, 400 si falta el período,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener el ranking de actividad docente en una
 * escuela específica. El `escuela_id` se resuelve según el rol del usuario.
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/actividad-docentes/escuela
 * @queryparam periodo    - Año del período.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `ActividadResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener la cobertura de evaluaciones por zona
 * a nivel nacional (cantidad de evaluaciones y estudiantes evaluados por zona).
 * Solo accesible para el rol `equipo_padi`.
 *
 * @route GET /estadisticas/cobertura/zonas
 * @queryparam periodo - Año del período.
 * @returns 200 con `CoberturaResponse`, 400 si falta el período,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener la comparativa de rendimiento por área
 * entre la escuela, su zona y el promedio nacional.
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/comparativa/escuela
 * @queryparam periodo    - Año del período.
 * @queryparam tipo       - Tipo de evaluación: `"inicial"` o `"final"`.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `ComparativaResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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

/**
 * Maneja la solicitud para obtener la progresión histórica de un estudiante
 * a través de sus últimas evaluaciones, en la vista del docente.
 *
 * Si el usuario es `docente`, el sistema verifica que el estudiante pertenezca
 * a una de sus aulas. Para otros roles (`director`, `encargado_zona`, `equipo_padi`),
 * se debe proveer el `aula_id` en el query.
 *
 * @route GET /estadisticas/progresion/docente
 * @queryparam estudiante_id - ID del estudiante a consultar.
 * @queryparam aula_id       - ID del aula (requerido para roles distintos a `docente`).
 * @returns 200 con `ProgresionResponse`, 400 si falta `estudiante_id`,
 *          o 403 si el acceso no está autorizado.
 */
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

/**
 * Maneja la solicitud para obtener la progresión histórica de un estudiante
 * en la vista de la escuela. Verifica que el estudiante pertenezca a la
 * escuela resuelta por `resolveEscuelaId`.
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/progresion/escuela
 * @queryparam estudiante_id - ID del estudiante a consultar.
 * @queryparam escuela_id    - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `ProgresionResponse`, 400 si faltan parámetros,
 *          o 403 si el acceso no está autorizado.
 */
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

/**
 * Maneja la solicitud para obtener la tasa de aprobación por pregunta
 * en un aula y período dado. Las preguntas se ordenan de menor a mayor
 * tasa (las más difíciles primero).
 * Accesible para los roles `docente`, `director`, `encargado_zona` y `equipo_padi`.
 * Si el usuario es docente, se valida que el aula le pertenezca.
 *
 * @route GET /estadisticas/aprobacion-preguntas
 * @queryparam periodo  - Año del período.
 * @queryparam aula_id  - ID del aula a consultar.
 * @queryparam area_id  - (Opcional) Filtra las preguntas de un área específica.
 * @returns 200 con `AprobacionPreguntasResponse`, 400 si faltan parámetros,
 *          o 403 si el acceso no está autorizado.
 */
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

/**
 * Maneja la solicitud para obtener la distribución de puntajes promedio
 * de los estudiantes de un aula en cinco rangos percentuales.
 * Accesible para los roles `docente`, `director`, `encargado_zona` y `equipo_padi`.
 * Si el usuario es docente, se valida que el aula le pertenezca.
 *
 * @route GET /estadisticas/distribucion-puntajes
 * @queryparam periodo - Año del período.
 * @queryparam aula_id - ID del aula a consultar.
 * @returns 200 con `DistribucionResponse`, 400 si faltan parámetros,
 *          o 403 si el acceso no está autorizado.
 */
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

/**
 * Maneja la solicitud para obtener el rendimiento por área segmentado
 * por nivel socioeconómico de las escuelas a nivel nacional.
 * Solo accesible para el rol `equipo_padi`.
 *
 * @route GET /estadisticas/rendimiento-nse
 * @queryparam periodo - Año del período.
 * @queryparam tipo    - Tipo de evaluación: `"inicial"` o `"final"`.
 * @returns 200 con `RendimientoNivelResponse`, 400 si los parámetros son inválidos,
 *          o 403 si el rol no tiene acceso.
 */
export async function getRendimientoNivelSocioeconomico(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = parsePeriodo(req.query.periodo);
    const tipo = String(req.query.tipo ?? "");
    if (!periodo || !TIPOS_VALIDOS.includes(tipo)) return badParams(res);

    const data = await service.rendimientoPorNivelSocioeconomico({
      periodo,
      tipo,
      rol: String(req.user!.rol),
    });
    return res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    return res.status(403).json(commonResponse(false, error.message, null));
  }
}

/**
 * Maneja la solicitud para obtener el heatmap de rendimiento por área
 * agrupado por aulas dentro de una escuela específica. El `escuela_id`
 * se resuelve según el rol del usuario (ver `resolveEscuelaId`).
 * Accesible para los roles `director`, `encargado_zona` y `equipo_padi`.
 *
 * @route GET /estadisticas/heatmap/aulas
 * @queryparam periodo    - Año del período.
 * @queryparam tipo       - Tipo de evaluación: `"inicial"` o `"final"`.
 * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
 * @returns 200 con `HeatmapResponse`, 400 si faltan parámetros,
 *          o 403 si el rol no tiene acceso.
 */
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
