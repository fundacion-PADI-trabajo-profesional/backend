import { Router } from "express";
import { listEncargados, createEncargado } from "../controllers/encargado-zona.controller";

export function createEncargadosRouter() {
    const router = Router();

    // Definimos las rutas internas como hiciste con docentes
    router.get("/encargados", listEncargados);
    router.post("/encargados", createEncargado);

    return router;
}