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
} from "../controllers/estadisticas.controller";
import { requireRole } from "../middlewares/auth.middleware";

export function createEstadisticasRouter() {
  const router = Router();

  router.get(
    "/estadisticas/padi/heatmap-zonas",
    requireRole("equipo_padi") as any,
    getHeatmapZonas
  );
  router.get(
    "/estadisticas/zona/heatmap-escuelas",
    requireRole("encargado_zona") as any,
    getHeatmapEscuelas
  );
  router.get(
    "/estadisticas/escuela/heatmap-aulas",
    requireRole("director", "encargado_zona", "equipo_padi") as any,
    getHeatmapAulas
  );
  router.get("/estadisticas/padi/evolucion", requireRole("equipo_padi") as any, getEvolucionPadi);
  router.get("/estadisticas/zona/evolucion", requireRole("encargado_zona") as any, getEvolucionZona);
  router.get("/estadisticas/escuela/evolucion", requireRole("director", "encargado_zona", "equipo_padi") as any, getEvolucionEscuela);
  router.get("/estadisticas/padi/areas-criticas", requireRole("equipo_padi") as any, getAreasCriticasPadi);
  router.get("/estadisticas/zona/areas-criticas", requireRole("encargado_zona") as any, getAreasCriticasZona);
  router.get("/estadisticas/escuela/areas-criticas", requireRole("director", "encargado_zona", "equipo_padi") as any, getAreasCriticasEscuela);
  router.get(
    "/estadisticas/zona/estudiantes-en-riesgo",
    requireRole("encargado_zona") as any,
    getEstudiantesEnRiesgoZona
  );
  router.get(
    "/estadisticas/escuela/estudiantes-en-riesgo",
    requireRole("director", "encargado_zona", "equipo_padi") as any,
    getEstudiantesEnRiesgoEscuela
  );

  router.get("/estadisticas/padi/cobertura-por-zona", requireRole("equipo_padi") as any, getCoberturaPorZona);
  router.get("/estadisticas/padi/rendimiento-por-nivel-socioeconomico", requireRole("equipo_padi") as any, getRendimientoNivelSocioeconomico);
  router.get("/estadisticas/zona/actividad-docentes", requireRole("encargado_zona") as any, getActividadDocentesZona);
  router.get("/estadisticas/escuela/actividad-docentes", requireRole("director", "encargado_zona", "equipo_padi") as any, getActividadDocentesEscuela);
  router.get("/estadisticas/escuela/comparativa", requireRole("director", "encargado_zona", "equipo_padi") as any, getComparativaEscuela);
  router.get("/estadisticas/docente/progresion-estudiante", requireRole("docente", "director", "encargado_zona", "equipo_padi") as any, getProgresionEstudianteDocente);
  router.get("/estadisticas/escuela/progresion-estudiante", requireRole("director", "encargado_zona", "equipo_padi") as any, getProgresionEstudianteEscuela);

  router.get(
    "/estadisticas/docente/aprobacion-preguntas",
    requireRole("docente", "director", "encargado_zona", "equipo_padi") as any,
    getAprobacionPreguntas
  );
  router.get(
    "/estadisticas/docente/distribucion-puntajes",
    requireRole("docente", "director", "encargado_zona", "equipo_padi") as any,
    getDistribucionPuntajes
  );

  return router;
}
