import { Router } from "express";
import * as Controller from "../controllers/evaluaciones.controller";

const router = Router();

router.post("/", Controller.createEvaluacion);
router.get("/", Controller.getEvaluaciones);
router.get("/:id", Controller.getEvaluacionById);
router.delete("/:id", Controller.deleteEvaluacion);

export default router;