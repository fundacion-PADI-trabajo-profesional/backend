import { Router } from "express";
import { listEncargados, createEncargado, updateEncargado, deleteEncargado, getCurrentEncargado } from "../controllers/encargado-zona.controller";
import { requireRole } from "../middlewares/auth.middleware";

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
