import { Router } from "express";
//import * as Controller from "../controllers/evaluaciones.controller";
import {
    createEvaluacion,
    getEvaluaciones,
    getEvaluacionById,
    deleteEvaluacion
} from "../controllers/evaluaciones.controller";

export function createEvaluacionesRouter() {
    const router = Router();

    router.post("/evaluaciones", createEvaluacion);
    router.get("/evaluaciones", getEvaluaciones);
    router.get("/evaluaciones/:id", getEvaluacionById);
    router.delete("/evaluaciones/:id", deleteEvaluacion);

    return router;
}
