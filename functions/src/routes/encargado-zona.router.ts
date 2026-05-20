import { Router } from "express";
import { listEncargados, createEncargado, updateEncargado, deleteEncargado, getCurrentEncargado } from "../controllers/encargado-zona.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router de encargados de zona con control de roles por ruta.
 *
 * @remarks
 * Las restricciones de acceso se dividen en dos grupos:
 * - **Cualquier usuario autenticado**: puede consultar su propio perfil (`/encargados/me`).
 * - **Solo `equipo_padi`**: listar, crear, editar y eliminar encargados.
 *
 * Rutas expuestas:
 * - `GET    /encargados/me` — retorna el perfil del encargado autenticado.
 * - `GET    /encargados` — lista todos los encargados de zona.
 * - `POST   /encargados` — crea un nuevo encargado de zona.
 * - `PUT    /encargados/:id` — actualiza perfil y zona de un encargado.
 * - `DELETE /encargados/:id` — elimina un encargado del sistema.
 *
 * @returns Router de Express configurado con las rutas de encargados de zona.
 */
export function createEncargadosRouter() {
    const router = Router();

    // Ver propio perfil: cualquier autenticado
    router.get("/encargados/me", getCurrentEncargado);

    // Listar, crear, editar y eliminar: solo equipo_padi
    router.get("/encargados", requireRole("equipo_padi") as any, listEncargados);
    router.post("/encargados", requireRole("equipo_padi") as any, createEncargado);
    router.put("/encargados/:id", requireRole("equipo_padi") as any, updateEncargado);
    router.delete("/encargados/:id", requireRole("equipo_padi") as any, deleteEncargado);

    return router;
}
