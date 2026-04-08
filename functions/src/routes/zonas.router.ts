import { Router } from "express";
import { createZona, listZonas, getZona, addEscuela, listEscuelasDisponibles, removeEscuela, updateZona, addEncargado, listEncargadosSinZona, removeEncargado, listEncargados } from "../controllers/zonas.controller";
import { requireRole } from "../middlewares/auth.middleware";

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
    router.get("/encargados-sin-zona", requireRole("equipo_padi") as any, listEncargadosSinZona);
    router.post("/zonas/:id/asignar-encargado", requireRole("equipo_padi") as any, addEncargado);
    router.post("/encargados/:encargadoId/quitar-zona", requireRole("equipo_padi") as any, removeEncargado);

    return router;
}
