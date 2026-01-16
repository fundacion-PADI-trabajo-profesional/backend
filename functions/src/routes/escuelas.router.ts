import { Router } from "express";
import {
    listEscuelas,
    createEscuela,
    removeDocenteFromEscuela,
    addDocenteToEscuela,
    updateEscuela,
    addDirectivoToEscuela,
    removeDirectivoFromEscuela,
    deleteEscuela
} from "../controllers/escuelas.controller";

export function createEscuelasRouter() {
    const router = Router();

    router.get("/escuelas", listEscuelas);
    router.post("/escuelas", createEscuela);
    router.post("/escuelas/asignar", addDocenteToEscuela);
    router.post("/escuelas/desasignar", removeDocenteFromEscuela);
    router.post("/escuelas/asignar-directivo", addDirectivoToEscuela);
    router.post("/escuelas/desasignar-directivo", removeDirectivoFromEscuela);
    router.put("/escuelas/:id", updateEscuela);
    router.delete("/escuelas/:id", deleteEscuela);

    return router;
}