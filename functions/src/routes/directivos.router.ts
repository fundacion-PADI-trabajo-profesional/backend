import { Router } from "express";
import { listDirectivos, assignEscuelaToDirectivo } from "../controllers/directivos.controller";

export function createDirectivosRouter() {
    const router = Router();
    router.get("/directivos", listDirectivos);
    router.post("/directivos/:id/asignar-escuela", assignEscuelaToDirectivo);
    return router;
}


