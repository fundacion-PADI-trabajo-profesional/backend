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

    router.post("/", createEvaluacion);
    router.get("/", getEvaluaciones);
    router.get("/:id", getEvaluacionById);
    router.delete("/:id", deleteEvaluacion);

    return router;
}
