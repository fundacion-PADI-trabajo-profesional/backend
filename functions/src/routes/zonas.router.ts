import { Router } from "express";
import { createZona, listZonas, getZona, addEscuela, listEscuelasDisponibles, removeEscuela, updateZona, addEncargado, listEncargadosSinZona, removeEncargado, listEncargados } from "../controllers/zonas.controller";

export function createZonasRouter() {
    const router = Router();

    router.get("/zonas", listZonas);
    router.post("/zonas", createZona);
    router.get("/zonas/encargados", listEncargados);
    router.get("/zonas/:id", getZona);
    router.post("/zonas/:id/asignar-escuela", addEscuela);
    router.get("/escuelas-sin-zona", listEscuelasDisponibles);
    router.post("/escuelas/:escuelaId/quitar-escuela", removeEscuela);
    router.put("/zonas/:id", updateZona);
    router.get("/encargados-sin-zona", listEncargadosSinZona);
    router.post("/zonas/:id/asignar-encargado", addEncargado);
    router.post("/encargados/:encargadoId/quitar-zona", removeEncargado);

    return router;
}