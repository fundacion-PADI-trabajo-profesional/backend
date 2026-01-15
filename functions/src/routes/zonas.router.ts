import { Router } from "express";
import { createZona, listZonas, getZona, addEscuela, listEscuelasDisponibles } from "../controllers/zonas.controller";

export function createZonasRouter() {
    const router = Router();

    router.get("/zonas", listZonas);
    router.post("/zonas", createZona);
    router.get("/zonas/:id", getZona);
    router.post("/zonas/:id/asignar-escuela", addEscuela);
    router.get("/escuelas-sin-zona", listEscuelasDisponibles);

    return router;
}