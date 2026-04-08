import express from "express";
import cors from "cors";
import { createHealthRouter } from "./routes/health.router";
import { createEvaluacionesRouter } from "./routes/evaluaciones.router";
import { createEstudiantesRouter } from "./routes/estudiantes.router"
import { createDocentesRouter } from "./routes/docentes.router"
import { createEncargadosRouter } from "./routes/encargado-zona.router";
import { createDirectivosRouter } from "./routes/directivos.router"
import { createEscuelasRouter } from "./routes/escuelas.router";
import { createAulasRouter } from "./routes/aulas.router";
import { createZonasRouter } from "./routes/zonas.router";
import { createAuthRouter } from "./routes/auth.router";
import { requireAuth } from "./middlewares/auth.middleware";

export function createApp() {
  const app = express();

  const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };

  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());

  // Rutas PUBLICAS (sin autenticacion)
  app.use(createHealthRouter());
  app.use(createAuthRouter());


  app.use(requireAuth as any);

  // RUTAS PROTEGIDAS: TODAS las rutas requieren JWT válido
  app.use(createEvaluacionesRouter());
  app.use(createEstudiantesRouter());
  app.use(createDocentesRouter());
  app.use(createDirectivosRouter());
  app.use(createEncargadosRouter());
  app.use(createEscuelasRouter());
  app.use(createAulasRouter());
  app.use(createZonasRouter());

  return app;
}


