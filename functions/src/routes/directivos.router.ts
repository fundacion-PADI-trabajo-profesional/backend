import { Router } from "express";
import { listDirectivos, assignEscuelaToDirectivo, listDirectivosDisponibles } from "../controllers/directivos.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router de directivos (usuarios con rol `"director"`).
 *
 * @remarks
 * Las rutas de este router requieren JWT válido y rol `"equipo_padi"`,
 * aplicados globalmente en el entry point de la aplicación.
 *
 * Rutas expuestas:
 * - `GET  /directivos` — lista todos los directivos con su escuela asignada.
 * - `GET  /directivos/disponibles` — lista directivos sin escuela asignada.
 * - `POST /directivos/:id/asignar-escuela` — asigna una escuela a un directivo.
 *
 * @returns Router de Express configurado con las rutas de directivos.
 */
export function createDirectivosRouter() {
    const router = Router();
    router.get("/directivos", requireRole("equipo_padi") as any, listDirectivos);
    router.get("/directivos/disponibles", requireRole("equipo_padi") as any, listDirectivosDisponibles);
    router.post("/directivos/:id/asignar-escuela", requireRole("equipo_padi") as any, assignEscuelaToDirectivo);
    return router;
}


