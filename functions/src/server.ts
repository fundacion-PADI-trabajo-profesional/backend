import express from "express";
import cors from "cors";
import { createHealthRouter } from "./routes/health.router";
import { createEvaluacionesRouter } from "./routes/evaluaciones.router";
import { createEstudiantesRouter } from "./routes/estudiantes.router"
import { createDocentesRouter } from "./routes/docentes.router"
import { createEncargadosRouter } from "./routes/encargado-zona.router";
import { createDirectivosRouter } from "./routes/directivos.router"
import { createEscuelasRouter } from "./routes/escuelas.router";
import authRouter from "./routes/auth.router";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createEvaluacionesRouter());
  app.use(createEstudiantesRouter());
  app.use(createDocentesRouter());
  app.use(createDirectivosRouter());
  app.use(createEncargadosRouter());
  app.use(createEscuelasRouter());
  app.use("/auth", authRouter);

  return app;
}


