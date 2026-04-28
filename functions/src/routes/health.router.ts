import { Router } from "express";
import { getHealth, getLivez, getReadyz } from "../controllers/health.controller";

// functions/src/routes/health.router.ts
// Define rutas HTTP y las asocia a controladores (sin lógica de negocio).
// Mantener este archivo liviano: paths + controlador correspondiente.
export function createHealthRouter() {
  const router = Router();
  router.get("/health", getHealth);
  router.get("/livez", getLivez);
  router.get("/readyz", getReadyz);
  return router;
}
