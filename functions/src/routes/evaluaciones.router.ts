import { Router } from "express";
import {
  listEvaluaciones,
  getEvaluacionById,
  listEvaluacionesInstancias,
  getEvaluacionInstanciaById,
  createEvaluacionInstancia,
} from "../controllers/evaluaciones.controller";

export function createEvaluacionesRouter() {
  const router = Router();
  router.get("/evaluaciones", listEvaluaciones);
  router.get("/evaluaciones/:id", getEvaluacionById);
  router.get("/evaluaciones-instancias", listEvaluacionesInstancias);
  router.get("/evaluaciones-instancias/:id", getEvaluacionInstanciaById);
  router.post("/evaluaciones-instancias", createEvaluacionInstancia);
  return router;
}


