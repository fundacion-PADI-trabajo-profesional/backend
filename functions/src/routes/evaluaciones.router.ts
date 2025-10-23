import { Router } from "express";
import { listEvaluaciones } from "../controllers/evaluaciones.controller";

export function createEvaluacionesRouter() {
  const router = Router();
  router.get("/evaluaciones", listEvaluaciones);
  return router;
}


