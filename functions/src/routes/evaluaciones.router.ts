import { Router } from "express";
import {
    createEvaluacion,
    getEvaluaciones,
    getEvaluacionById,
    deleteEvaluacion,
    getPreguntasDeArea,
    guardarRespuestasArea
} from "../controllers/evaluaciones.controller";

/**
 * Crea el router de evaluaciones y su flujo de respuestas por área.
 *
 * @remarks
 * Las rutas de este router requieren JWT válido. Los controles de acceso
 * por rol (director, docente, encargado zona, equipo padi) se aplican dentro de
 * cada controlador, ya que la lógica de filtrado es específica por endpoint.
 *
 * Rutas expuestas:
 * - `POST   /evaluaciones` — crea una nueva evaluación para un estudiante.
 * - `GET    /evaluaciones` — lista evaluaciones con filtros opcionales por rol.
 * - `GET    /evaluaciones/:id` — retorna el detalle completo de una evaluación.
 * - `DELETE /evaluaciones/:id` — elimina una evaluación y sus datos dependientes.
 * - `GET    /evaluaciones/:id/areas/:areaId/preguntas` — retorna las preguntas de un área
 *   junto con las respuestas previas del evaluador.
 * - `POST   /evaluaciones/:id/respuestas` — guarda las respuestas de un área y recalcula
 *   el estado y puntaje.
 *
 * @returns Router de Express configurado con las rutas de evaluaciones.
 */
export function createEvaluacionesRouter() {
    const router = Router();

    router.post("/evaluaciones", createEvaluacion);
    router.get("/evaluaciones", getEvaluaciones);
    router.get("/evaluaciones/:id", getEvaluacionById);
    router.delete("/evaluaciones/:id", deleteEvaluacion);
    //endpoints para preguntas y respuestas de áreas específicas dentro de una evaluación
    router.get("/evaluaciones/:id/areas/:areaId/preguntas", getPreguntasDeArea);
    router.post("/evaluaciones/:id/respuestas", guardarRespuestasArea);

    return router;
}
