import { Router } from "express";
import {
  getHeatmapZonas,
  getHeatmapEscuelas,
  getHeatmapAulas,
  getEvolucionPadi,
  getEvolucionZona,
  getEvolucionEscuela,
  getAreasCriticasPadi,
  getAreasCriticasZona,
  getAreasCriticasEscuela,
  getEstudiantesEnRiesgoZona,
  getEstudiantesEnRiesgoEscuela,
  getAprobacionPreguntas,
  getDistribucionPuntajes,
  getActividadDocentesZona,
  getActividadDocentesEscuela,
  getCoberturaPorZona,
  getComparativaEscuela,
  getProgresionEstudianteDocente,
  getProgresionEstudianteEscuela,
  getRendimientoNivelSocioeconomico,
  getExportEvaluaciones,
} from "../controllers/estadisticas.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea y configura el router de estadísticas con todas sus rutas protegidas.
 *
 * Las rutas están organizadas por prefijo de alcance:
 * - `/estadisticas/padi/...`    → Exclusivas del equipo PADI (vista nacional).
 * - `/estadisticas/zona/...`    → Exclusivas del encargado de zona.
 * - `/estadisticas/escuela/...` → Accesibles por director, encargado_zona y equipo_padi.
 * - `/estadisticas/docente/...` → Accesibles por docente, director, encargado_zona y equipo_padi.
 *
 * Todas las rutas requieren autenticación y validan el rol mediante el
 * middleware `requireRole`. Los parámetros de filtrado (periodo, tipo, escuela_id,
 * umbral, etc.) se reciben como query params y son validados en el controlador.
 *
 * @returns Router de Express configurado con las rutas del módulo de estadísticas.
 */
export function createEstadisticasRouter() {
  const router = Router();

  // ─── Heatmaps ────────────────────────────────────────────────────────────────

  /**
   * GET /estadisticas/padi/heatmap-zonas
   * Heatmap de rendimiento por área agrupado por zonas a nivel nacional.
   * @queryparam periodo - Año del período.
   * @queryparam tipo    - `"inicial"` | `"final"`.
   * @roles equipo_padi
   */
  router.get(
    "/estadisticas/padi/heatmap-zonas",
    requireRole("equipo_padi") as any,
    getHeatmapZonas
  );

  /**
   * GET /estadisticas/zona/heatmap-escuelas
   * Heatmap de rendimiento por área agrupado por escuelas dentro de la zona
   * del encargado autenticado.
   * @queryparam periodo - Año del período.
   * @queryparam tipo    - `"inicial"` | `"final"`.
   * @roles encargado_zona
   */
  router.get(
    "/estadisticas/zona/heatmap-escuelas",
    requireRole("encargado_zona") as any,
    getHeatmapEscuelas
  );

  /**
   * GET /estadisticas/escuela/heatmap-aulas
   * Heatmap de rendimiento por área agrupado por aulas dentro de una escuela.
   * @queryparam periodo    - Año del período.
   * @queryparam tipo       - `"inicial"` | `"final"`.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get(
    "/estadisticas/escuela/heatmap-aulas",
    requireRole("director", "encargado_zona", "equipo_padi") as any,
    getHeatmapAulas
  );

  // ─── Evolución ───────────────────────────────────────────────────────────────

  /**
   * GET /estadisticas/padi/evolucion
   * Evolución del rendimiento por área entre evaluación inicial y final,
   * a nivel nacional.
   * @queryparam periodo - Año del período.
   * @roles equipo_padi
   */
  router.get("/estadisticas/padi/evolucion", requireRole("equipo_padi") as any, getEvolucionPadi);

  /**
   * GET /estadisticas/zona/evolucion
   * Evolución del rendimiento por área en la zona del encargado autenticado.
   * @queryparam periodo - Año del período.
   * @roles encargado_zona
   */
  router.get("/estadisticas/zona/evolucion", requireRole("encargado_zona") as any, getEvolucionZona);

  /**
   * GET /estadisticas/escuela/evolucion
   * Evolución del rendimiento por área en una escuela específica.
   * @queryparam periodo    - Año del período.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/escuela/evolucion", requireRole("director", "encargado_zona", "equipo_padi") as any, getEvolucionEscuela);

  // ─── Áreas críticas ──────────────────────────────────────────────────────────

  /**
   * GET /estadisticas/padi/areas-criticas
   * Áreas con menor rendimiento promedio a nivel nacional, ordenadas de peor a mejor.
   * @queryparam periodo - Año del período.
   * @queryparam tipo    - `"inicial"` | `"final"`.
   * @roles equipo_padi
   */
  router.get("/estadisticas/padi/areas-criticas", requireRole("equipo_padi") as any, getAreasCriticasPadi);

  /**
   * GET /estadisticas/zona/areas-criticas
   * Áreas con menor rendimiento promedio en la zona del encargado autenticado.
   * @queryparam periodo - Año del período.
   * @queryparam tipo    - `"inicial"` | `"final"`.
   * @roles encargado_zona
   */
  router.get("/estadisticas/zona/areas-criticas", requireRole("encargado_zona") as any, getAreasCriticasZona);

  /**
   * GET /estadisticas/escuela/areas-criticas
   * Áreas con menor rendimiento promedio en una escuela específica.
   * @queryparam periodo    - Año del período.
   * @queryparam tipo       - `"inicial"` | `"final"`.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/escuela/areas-criticas", requireRole("director", "encargado_zona", "equipo_padi") as any, getAreasCriticasEscuela);

  // ─── Estudiantes en riesgo ───────────────────────────────────────────────────

  /**
   * GET /estadisticas/zona/estudiantes-en-riesgo
   * Estudiantes cuyo promedio en al menos 2 áreas es inferior al umbral,
   * dentro de la zona del encargado autenticado.
   * @queryparam periodo - Año del período.
   * @queryparam umbral  - (Opcional) Umbral de riesgo entre 0 y 1; por defecto `0.5`.
   * @roles encargado_zona
   */
  router.get(
    "/estadisticas/zona/estudiantes-en-riesgo",
    requireRole("encargado_zona") as any,
    getEstudiantesEnRiesgoZona
  );

  /**
   * GET /estadisticas/escuela/estudiantes-en-riesgo
   * Estudiantes en riesgo dentro de una escuela específica.
   * @queryparam periodo    - Año del período.
   * @queryparam umbral     - (Opcional) Umbral de riesgo entre 0 y 1; por defecto `0.5`.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get(
    "/estadisticas/escuela/estudiantes-en-riesgo",
    requireRole("director", "encargado_zona", "equipo_padi") as any,
    getEstudiantesEnRiesgoEscuela
  );

  // ─── Cobertura y NSE ─────────────────────────────────────────────────────────

  /**
   * GET /estadisticas/padi/cobertura-por-zona
   * Cobertura de evaluaciones a nivel nacional desglosada por zona:
   * cantidad de evaluaciones y estudiantes distintos evaluados.
   * @queryparam periodo - Año del período.
   * @roles equipo_padi
   */
  router.get("/estadisticas/padi/cobertura-por-zona", requireRole("equipo_padi") as any, getCoberturaPorZona);

  /**
   * GET /estadisticas/padi/export-evaluaciones
   * Dataset completo de evaluaciones del período para el export a Excel.
   * @queryparam periodo - Año del período.
   * @roles equipo_padi
   */
  router.get(
    "/estadisticas/padi/export-evaluaciones",
    requireRole("equipo_padi") as any,
    getExportEvaluaciones
  );

  /**
   * GET /estadisticas/padi/rendimiento-por-nivel-socioeconomico
   * Rendimiento por área segmentado por nivel socioeconómico de las escuelas
   * (alto, medio, bajo, sin_definir) a nivel nacional.
   * @queryparam periodo - Año del período.
   * @queryparam tipo    - `"inicial"` | `"final"`.
   * @roles equipo_padi
   */
  router.get("/estadisticas/padi/rendimiento-por-nivel-socioeconomico", requireRole("equipo_padi") as any, getRendimientoNivelSocioeconomico);

  // ─── Actividad docente ───────────────────────────────────────────────────────

  /**
   * GET /estadisticas/zona/actividad-docentes
   * Ranking de docentes por cantidad de evaluaciones registradas en la zona
   * del encargado autenticado.
   * @queryparam periodo - Año del período.
   * @roles encargado_zona
   */
  router.get("/estadisticas/zona/actividad-docentes", requireRole("encargado_zona") as any, getActividadDocentesZona);

  /**
   * GET /estadisticas/escuela/actividad-docentes
   * Ranking de docentes por cantidad de evaluaciones registradas en una escuela.
   * @queryparam periodo    - Año del período.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/escuela/actividad-docentes", requireRole("director", "encargado_zona", "equipo_padi") as any, getActividadDocentesEscuela);

  // ─── Comparativa y progresión ────────────────────────────────────────────────

  /**
   * GET /estadisticas/escuela/comparativa
   * Comparativa del rendimiento por área entre la escuela, su zona y el
   * promedio nacional.
   * @queryparam periodo    - Año del período.
   * @queryparam tipo       - `"inicial"` | `"final"`.
   * @queryparam escuela_id - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/escuela/comparativa", requireRole("director", "encargado_zona", "equipo_padi") as any, getComparativaEscuela);

  /**
   * GET /estadisticas/docente/progresion-estudiante
   * Progresión histórica de un estudiante a través de sus últimas evaluaciones,
   * vista desde el docente. Si el usuario es docente, se valida que el estudiante
   * pertenezca a una de sus aulas. Para otros roles, se requiere `aula_id`.
   * @queryparam estudiante_id - ID del estudiante.
   * @queryparam aula_id       - ID del aula (requerido para roles distintos a `docente`).
   * @roles docente | director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/docente/progresion-estudiante", requireRole("docente", "director", "encargado_zona", "equipo_padi") as any, getProgresionEstudianteDocente);

  /**
   * GET /estadisticas/escuela/progresion-estudiante
   * Progresión histórica de un estudiante vista desde la escuela. Se valida que
   * el estudiante pertenezca a la escuela resuelta por el rol del usuario.
   * @queryparam estudiante_id - ID del estudiante.
   * @queryparam escuela_id    - ID de la escuela (requerido para encargado_zona y equipo_padi).
   * @roles director | encargado_zona | equipo_padi
   */
  router.get("/estadisticas/escuela/progresion-estudiante", requireRole("director", "encargado_zona", "equipo_padi") as any, getProgresionEstudianteEscuela);

  // ─── Vista docente ───────────────────────────────────────────────────────────

  /**
   * GET /estadisticas/docente/aprobacion-preguntas
   * Tasa de aprobación por pregunta en un aula y período dado, ordenadas de
   * menor a mayor aprobación (las más difíciles primero). Opcionalmente
   * filtrable por área. Si el usuario es docente, se valida el acceso al aula.
   * @queryparam periodo  - Año del período.
   * @queryparam aula_id  - ID del aula.
   * @queryparam area_id  - (Opcional) Filtra por área específica.
   * @roles docente | director | encargado_zona | equipo_padi
   */
  router.get(
    "/estadisticas/docente/aprobacion-preguntas",
    requireRole("docente", "director", "encargado_zona", "equipo_padi") as any,
    getAprobacionPreguntas
  );

  /**
   * GET /estadisticas/docente/distribucion-puntajes
   * Distribución de los puntajes promedio de los estudiantes de un aula en
   * cinco rangos percentuales: 0–20%, 21–40%, 41–60%, 61–80%, 81–100%.
   * Si el usuario es docente, se valida el acceso al aula.
   * @queryparam periodo - Año del período.
   * @queryparam aula_id - ID del aula.
   * @roles docente | director | encargado_zona | equipo_padi
   */
  router.get(
    "/estadisticas/docente/distribucion-puntajes",
    requireRole("docente", "director", "encargado_zona", "equipo_padi") as any,
    getDistribucionPuntajes
  );

  return router;
}
