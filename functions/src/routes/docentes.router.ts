import { Router } from "express";
import { listDocentes } from "../controllers/docentes.controller";

export function createDocentesRouter() {
  const router = Router();
  router.get("/docentes", listDocentes);
  return router;
}


