import { Router } from "express";
import { listDirectivos } from "../controllers/directivos.controller";

export function createDirectivosRouter() {
    const router = Router();
    router.get("/directivos", listDirectivos);
    return router;
}


