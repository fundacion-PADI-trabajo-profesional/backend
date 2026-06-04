import { Router } from "express";
import { createZona, listZonas, getZona, addEscuela, listEscuelasDisponibles, removeEscuela, updateZona, addEncargado, listEncargadosSinZona, removeEncargado, listEncargados, deleteZona } from "../controllers/zonas.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router de zonas geográficas y sus asignaciones de escuelas y encargados.
 *
 * @remarks
 * **Todas** las rutas de este router requieren el rol `"equipo_padi"`, aplicado
 * individualmente a cada ruta. El JWT ya fue validado por `requireAuth` en el
 * entry point de la aplicación.
 *
 * Rutas expuestas:
 * - `GET  /zonas` — lista todas las zonas con conteo de escuelas y encargados.
 * - `POST /zonas` — crea una zona nueva.
 * - `GET  /zonas/encargados` — lista todos los encargados con su zona asignada.
 * - `GET  /zonas/:id` — retorna el detalle de una zona con escuelas y encargados.
 * - `PUT  /zonas/:id` — actualiza el nombre de una zona.
 * - `POST /zonas/:id/asignar-escuela` — asigna una escuela a la zona.
 * - `POST /zonas/:id/asignar-encargado` — asigna un encargado a la zona.
 * - `GET  /escuelas-sin-zona` — lista escuelas disponibles para asignar a una zona.
 * - `POST /escuelas/:escuelaId/quitar-escuela` — desasigna una escuela de su zona.
 * - `GET  /encargados-sin-zona` — lista encargados disponibles para asignar.
 * - `POST /encargados/:encargadoId/quitar-zona` — desasigna un encargado de su zona.
 *
 * @returns Router de Express configurado con las rutas de zonas.
 */
export function createZonasRouter() {
    const router = Router();

    // Todas las operaciones de zonas son exclusivas del equipo_padi
    router.get("/zonas", requireRole("equipo_padi") as any, listZonas);
    router.post("/zonas", requireRole("equipo_padi") as any, createZona);
    router.get("/zonas/encargados", requireRole("equipo_padi") as any, listEncargados);
    router.get("/zonas/:id", requireRole("equipo_padi") as any, getZona);
    router.post("/zonas/:id/asignar-escuela", requireRole("equipo_padi") as any, addEscuela);
    router.get("/escuelas-sin-zona", requireRole("equipo_padi") as any, listEscuelasDisponibles);
    router.post("/escuelas/:escuelaId/quitar-escuela", requireRole("equipo_padi") as any, removeEscuela);
    router.put("/zonas/:id", requireRole("equipo_padi") as any, updateZona);
    router.delete("/zonas/:id", requireRole("equipo_padi") as any, deleteZona);
    router.get("/encargados-sin-zona", requireRole("equipo_padi") as any, listEncargadosSinZona);
    router.post("/zonas/:id/asignar-encargado", requireRole("equipo_padi") as any, addEncargado);
    router.post("/encargados/:encargadoId/quitar-zona", requireRole("equipo_padi") as any, removeEncargado);

    return router;
}
