import { Router } from "express";
import {
  assignDocenteEscuela,
  listDocentes,
  unassignDocenteEscuela,
} from "../controllers/docentes.controller";

/**
 * Crea el router de docentes con la gestión de asignaciones a escuelas.
 *
 * @remarks
 * Las rutas de este router requieren JWT válido. El control de roles
 * (solo `"equipo_padi"` puede modificar asignaciones) se aplica en
 * el entry point o en los controladores.
 *
 * Rutas expuestas:
 * - `GET  /docentes` — lista docentes con sus asignaciones activas.
 * - `POST /docentes/:id/asignar-escuela` — asigna un docente a una escuela.
 * - `POST /docentes/:id/desasignar-escuela` — desasigna un docente de su escuela.
 *
 * @returns Router de Express configurado con las rutas de docentes.
 */
export function createDocentesRouter() {
  const router = Router();
  router.get("/docentes", listDocentes);
  router.post("/docentes/:id/asignar-escuela", assignDocenteEscuela);
  router.post("/docentes/:id/desasignar-escuela", unassignDocenteEscuela);
  return router;
}
