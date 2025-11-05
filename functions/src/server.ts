import express from "express";
import cors from "cors";
import { createHealthRouter } from "./routes/health.router";
import { createEvaluacionesRouter } from "./routes/evaluaciones.router";
import authRouter from "./routes/auth.router";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createEvaluacionesRouter());
  app.use("/auth", authRouter);

  return app;
}


