import { Router } from "express";
import { listEncargados, createEncargado, updateEncargado, deleteEncargado, getCurrentEncargado } from "../controllers/encargado-zona.controller";

export function createEncargadosRouter() {
    const router = Router();

    router.get("/encargados", listEncargados);
    router.get("/encargados/me", getCurrentEncargado);
    router.post("/encargados", createEncargado);
    router.put("/encargados/:id", updateEncargado);
    router.delete("/encargados/:id", deleteEncargado);

    return router;
}