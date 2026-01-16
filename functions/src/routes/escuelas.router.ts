import { Router } from "express";
import { listEscuelas, createEscuela, removeDocenteFromEscuela, addDocenteToEscuela, updateEscuela } from "../controllers/escuelas.controller";

export function createEscuelasRouter() {
    const router = Router();

    router.get("/escuelas", listEscuelas);
    router.post("/escuelas", createEscuela);
    router.post("/escuelas/asignar", addDocenteToEscuela);
    router.post("/escuelas/desasignar", removeDocenteFromEscuela);
    router.put("/escuelas/:id", updateEscuela);

    return router;
}