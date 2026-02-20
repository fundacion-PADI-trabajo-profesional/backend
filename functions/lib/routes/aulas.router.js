"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAulasRouter = createAulasRouter;
const express_1 = require("express");
const aulas_controller_1 = require("../controllers/aulas.controller");
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
    router.get("/docentes/aulas", aulas_controller_1.listDocenteAulas);
    router.post("/aulas/:id/asignar-estudiante", aulas_controller_1.asignarEstudianteAula);
    router.post("/aulas/:id/desasignar-estudiante", aulas_controller_1.desasignarEstudianteAula);
    return router;
}
