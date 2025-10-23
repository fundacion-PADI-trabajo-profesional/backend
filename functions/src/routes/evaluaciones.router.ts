import { Router } from "express";
import { listEvaluaciones, getEvaluacionById } from "../controllers/evaluaciones.controller";

export function createEvaluacionesRouter() {
  const router = Router();
  router.get("/evaluaciones", listEvaluaciones);
  router.get("/evaluaciones/:id", getEvaluacionById);
  return router;
}


