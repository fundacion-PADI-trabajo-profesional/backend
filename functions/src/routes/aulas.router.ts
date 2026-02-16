import { Router } from "express";
import {
  createAula,
  listAulas,
  updateAula,
  deleteAula,
  listAulaDocentes,
  asignarDocenteAula,
  desasignarDocenteAula,
  listDocenteAulas,
} from "../controllers/aulas.controller";

export function createAulasRouter() {
  const router = Router();

  router.get("/aulas", listAulas);
  router.post("/aulas", createAula);
  router.put("/aulas/:id", updateAula);
  router.delete("/aulas/:id", deleteAula);

  router.get("/aulas/:id/docentes", listAulaDocentes);
  router.post("/aulas/:id/asignar-docente", asignarDocenteAula);
  router.post("/aulas/:id/desasignar-docente", desasignarDocenteAula);
  router.get("/docentes/aulas", listDocenteAulas);

  return router;
}

