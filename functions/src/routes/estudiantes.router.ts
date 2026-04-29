import { Router } from "express"
import {
    createEstudiante,
    listEstudiantes,
    getGeneros,
    getSalas,
    asignarEstudianteAula,
    desasignarEstudianteAula,
    bulkCreateEstudiantes,
    updateEstudiante,
} from "../controllers/estudiantes.controller"

/**
 * Crea el router de estudiantes con sus catálogos y operaciones de aula.
 *
 * @remarks
 * Las rutas de este router requieren JWT válido. Los controles de acceso
 * por rol se aplican en los servicios (p. ej. directores solo ven su escuela).
 *
 * Rutas expuestas:
 * - `GET  /estudiantes` — lista estudiantes según scope del rol del usuario.
 * - `POST /estudiantes` — crea un estudiante nuevo.
 * - `PUT  /estudiantes/:id` — actualiza datos de un estudiante.
 * - `POST /estudiantes/bulk` — importación masiva de estudiantes (con preview `dryRun`).
 * - `POST /estudiantes/asignar-aula` — asigna un estudiante a un aula.
 * - `POST /estudiantes/desasignar-aula` — desasigna un estudiante de su aula.
 * - `GET  /generos` — catálogo de géneros para formularios.
 * - `GET  /salas` — catálogo de salas (años) para formularios.
 *
 * @returns Router de Express configurado con las rutas de estudiantes.
 */
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
    router.put("/estudiantes/:id", updateEstudiante)
    
    router.post("/estudiantes/bulk", bulkCreateEstudiantes);

    return router
}