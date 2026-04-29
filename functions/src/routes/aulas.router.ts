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
  listAulaEstudiantes,
  asignarEstudianteAula,
  desasignarEstudianteAula,
} from "../controllers/aulas.controller";

/**
 * Crea el router de aulas con sus sub-recursos de docentes y estudiantes.
 *
 * @remarks
 * Las rutas de este router requieren JWT válido (aplicado globalmente en el
 * entry point). Los controles de rol adicionales se realizan en los servicios
 * y controladores según el rol del usuario autenticado.
 *
 * Rutas expuestas:
 * - `GET    /aulas` — lista aulas accesibles según rol del usuario.
 * - `POST   /aulas` — crea un aula nueva.
 * - `PUT    /aulas/:id` — actualiza datos de un aula.
 * - `DELETE /aulas/:id` — elimina un aula.
 * - `GET    /aulas/:id/docentes` — lista docentes asignados al aula.
 * - `POST   /aulas/:id/asignar-docente` — asigna un docente al aula.
 * - `POST   /aulas/:id/desasignar-docente` — desasigna un docente del aula.
 * - `GET    /aulas/:id/estudiantes` — lista estudiantes activos del aula.
 * - `POST   /aulas/:id/asignar-estudiante` — agrega un estudiante al aula.
 * - `POST   /aulas/:id/desasignar-estudiante` — quita un estudiante del aula.
 * - `GET    /docentes/aulas` — lista aulas del docente autenticado con sus estudiantes.
 *
 * @returns Router de Express configurado con las rutas de aulas.
 */
export function createAulasRouter() {
  const router = Router();

  router.get("/aulas", listAulas);
  router.post("/aulas", createAula);
  router.put("/aulas/:id", updateAula);
  router.delete("/aulas/:id", deleteAula);

  router.get("/aulas/:id/docentes", listAulaDocentes);
  router.post("/aulas/:id/asignar-docente", asignarDocenteAula);
  router.post("/aulas/:id/desasignar-docente", desasignarDocenteAula);
  router.get("/aulas/:id/estudiantes", listAulaEstudiantes);
  router.post("/aulas/:id/asignar-estudiante", asignarEstudianteAula);
  router.post("/aulas/:id/desasignar-estudiante", desasignarEstudianteAula);
  router.get("/docentes/aulas", listDocenteAulas);

  return router;
}

