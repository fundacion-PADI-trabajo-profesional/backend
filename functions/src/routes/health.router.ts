import { Router } from "express";
import { getHealth } from "../controllers/health.controller";


// functions/src/routes/health.router.ts
// Define rutas HTTP y las asocia a controladores (sin lógica de negocio).
// Mantener este archivo liviano: paths + controlador correspondiente.
export function createHealthRouter() {
  const router = Router();
  router.get("/health", getHealth);
  return router;
}


