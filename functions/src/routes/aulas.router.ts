import { Router } from "express";
import { createAula, listAulas, updateAula, deleteAula } from "../controllers/aulas.controller";

export function createAulasRouter() {
  const router = Router();

  router.get("/aulas", listAulas);
  router.post("/aulas", createAula);
  router.put("/aulas/:id", updateAula);
  router.delete("/aulas/:id", deleteAula);

  return router;
}

