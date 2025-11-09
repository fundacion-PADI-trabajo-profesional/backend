import { Router } from "express"
import {
    createEstudiante,
    listEstudiantes,
    getGeneros,
    getSalas,
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

    return router
}