import { Router } from "express";
import { getHealth } from "../controllers/health.controller";

export function createHealthRouter() {
  const router = Router();
  router.get("/health", getHealth);
  return router;
}


