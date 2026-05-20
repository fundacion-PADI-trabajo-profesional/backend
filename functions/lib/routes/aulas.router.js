"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAulasRouter = createAulasRouter;
const express_1 = require("express");
const aulas_controller_1 = require("../controllers/aulas.controller");
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
function createAulasRouter() {
    const router = (0, express_1.Router)();
    router.get("/aulas", aulas_controller_1.listAulas);
    router.post("/aulas", aulas_controller_1.createAula);
    router.put("/aulas/:id", aulas_controller_1.updateAula);
    router.delete("/aulas/:id", aulas_controller_1.deleteAula);
    router.get("/aulas/:id/docentes", aulas_controller_1.listAulaDocentes);
    router.post("/aulas/:id/asignar-docente", aulas_controller_1.asignarDocenteAula);
    router.post("/aulas/:id/desasignar-docente", aulas_controller_1.desasignarDocenteAula);
    router.get("/aulas/:id/estudiantes", aulas_controller_1.listAulaEstudiantes);
    router.post("/aulas/:id/asignar-estudiante", aulas_controller_1.asignarEstudianteAula);
    router.post("/aulas/:id/desasignar-estudiante", aulas_controller_1.desasignarEstudianteAula);
    router.get("/docentes/aulas", aulas_controller_1.listDocenteAulas);
    return router;
}
