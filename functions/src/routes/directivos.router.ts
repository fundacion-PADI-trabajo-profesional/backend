import { Router } from "express";
import { listDirectivos, assignEscuelaToDirectivo, listDirectivosDisponibles } from "../controllers/directivos.controller";

export function createDirectivosRouter() {
    const router = Router();
    router.get("/directivos", listDirectivos);
    router.get("/directivos/disponibles", listDirectivosDisponibles);
    router.post("/directivos/:id/asignar-escuela", assignEscuelaToDirectivo);
    return router;
}


