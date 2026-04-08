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

export function createEscuelasRouter() {
    const router = Router();

    // Listar: equipo_padi y encargado_zona
    router.get("/escuelas", requireRole("equipo_padi", "encargado_zona") as any, listEscuelas);

    // Crear y modificar: equipo_padi y encargado_zona (servicio aplica scope de zona)
    router.post("/escuelas", requireRole("equipo_padi", "encargado_zona") as any, createEscuela);
    router.put("/escuelas/:id", requireRole("equipo_padi", "encargado_zona") as any, updateEscuela);

    // Asignación de directivos y eliminación: solo equipo_padi
    router.post("/escuelas/asignar-directivo", requireRole("equipo_padi") as any, addDirectivoToEscuela);
    router.post("/escuelas/desasignar-directivo", requireRole("equipo_padi") as any, removeDirectivoFromEscuela);
    router.delete("/escuelas/:id", requireRole("equipo_padi") as any, deleteEscuela);

    return router;
}
