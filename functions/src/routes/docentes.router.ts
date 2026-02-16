import { Router } from "express";
import {
  assignDocenteEscuela,
  listDocentes,
  unassignDocenteEscuela,
} from "../controllers/docentes.controller";

export function createDocentesRouter() {
  const router = Router();
  router.get("/docentes", listDocentes);
  router.post("/docentes/:id/asignar-escuela", assignDocenteEscuela);
  router.post("/docentes/:id/desasignar-escuela", unassignDocenteEscuela);
  return router;
}
