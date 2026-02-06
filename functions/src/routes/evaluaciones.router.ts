import { Router } from "express";
//import * as Controller from "../controllers/evaluaciones.controller";
import {
    createEvaluacion,
    getEvaluaciones,
    getEvaluacionById,
    deleteEvaluacion,
    getPreguntasDeArea,
    guardarRespuestasArea
} from "../controllers/evaluaciones.controller";

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
