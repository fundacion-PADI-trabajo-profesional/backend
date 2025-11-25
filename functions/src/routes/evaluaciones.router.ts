// Archivo: evaluaciones.router.ts

import { Router } from "express"
import {
  createEvaluacion,
  listEvaluaciones,
  getEvaluacionById,
} from "../controllers/evaluaciones.controller"

export function createEvaluacionesRouter() {
  const router = Router()

  // POST: Crear una nueva evaluación (Se inicializa con 4 áreas en estado 'No Iniciada')
  router.post("/evaluaciones", createEvaluacion)

  // GET: Listar todas las evaluaciones (Vista de resumen)
  router.get("/evaluaciones", listEvaluaciones)

  // GET: Obtener el detalle de una evaluación por ID (Incluye las 4 áreas y sus estados)
  router.get("/evaluaciones/:id", getEvaluacionById)

  return router
}