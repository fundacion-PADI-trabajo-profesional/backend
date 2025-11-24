import { Router } from "express";
import { listEscuelas, createEscuela } from "../controllers/escuelas.controller";

export function createEscuelasRouter() {
    const router = Router();

    router.get("/escuelas", listEscuelas);
    router.post("/escuelas", createEscuela);

    return router;
}