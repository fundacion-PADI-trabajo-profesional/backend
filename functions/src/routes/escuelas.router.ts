import { Router } from "express";
import {
    listEscuelas,
    createEscuela,
    updateEscuela,
    addDirectivoToEscuela,
    removeDirectivoFromEscuela,
    deleteEscuela
} from "../controllers/escuelas.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router de escuelas con control de roles por ruta.
 *
 * @remarks
 * Las restricciones de acceso se aplican individualmente por ruta:
 * - **`equipo_padi` y `encargado_zona`**: pueden listar, crear y modificar escuelas.
 *   El servicio aplica el scope de zona para encargados (solo ven/editan las suyas).
 * - **Solo `equipo_padi`**: asignación/desasignación de directivos y eliminación.
 *
 * Rutas expuestas:
 * - `GET    /escuelas` — lista escuelas según scope del rol.
 * - `POST   /escuelas` — crea una escuela nueva.
 * - `PUT    /escuelas/:id` — actualiza datos de una escuela.
 * - `POST   /escuelas/asignar-directivo` — asigna un directivo a una escuela.
 * - `POST   /escuelas/desasignar-directivo` — desasigna un directivo de su escuela.
 * - `DELETE /escuelas/:id` — elimina una escuela del sistema.
 *
 * @returns Router de Express configurado con las rutas de escuelas.
 */
export function createEscuelasRouter() {
    const router = Router();

    // Listar: equipo_padi, encargado_zona y director (director ve solo su escuela via service)
    router.get("/escuelas", requireRole("equipo_padi", "encargado_zona", "director") as any, listEscuelas);

    // Crear y modificar: equipo_padi y encargado_zona (servicio aplica scope de zona)
    router.post("/escuelas", requireRole("equipo_padi", "encargado_zona") as any, createEscuela);
    router.put("/escuelas/:id", requireRole("equipo_padi", "encargado_zona") as any, updateEscuela);

    // Asignación de directivos y eliminación: solo equipo_padi
    router.post("/escuelas/asignar-directivo", requireRole("equipo_padi") as any, addDirectivoToEscuela);
    router.post("/escuelas/desasignar-directivo", requireRole("equipo_padi") as any, removeDirectivoFromEscuela);
    router.delete("/escuelas/:id", requireRole("equipo_padi") as any, deleteEscuela);

    return router;
}
