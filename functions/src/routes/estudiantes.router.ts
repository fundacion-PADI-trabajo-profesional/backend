import { Router } from "express"
import {
    createEstudiante,
    listEstudiantes,
    getGeneros,
    getSalas,
    asignarEstudianteAula,
    desasignarEstudianteAula,
} from "../controllers/estudiantes.controller"

export function createEstudiantesRouter() {
    const router = Router()

    // Rutas de Estudiantes
    // (Nombro las rutas base /estudiantes, /generos, /salas para claridad)
    router.get("/estudiantes", listEstudiantes)
    router.post("/estudiantes", createEstudiante)

    // Rutas para obtener datos para los formularios (dropdowns)
    router.get("/generos", getGeneros)
    router.get("/salas", getSalas)

    // Rutas para asignar/desasignar estudiantes a aulas
    router.post("/estudiantes/asignar-aula", asignarEstudianteAula)
    router.post("/estudiantes/desasignar-aula", desasignarEstudianteAula)

    return router
}