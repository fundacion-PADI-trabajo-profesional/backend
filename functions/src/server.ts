import express from "express";
import cors from "cors";
//import evaluacionesRouter from "./routes/evaluaciones.router";
import { createHealthRouter } from "./routes/health.router";
import { createEvaluacionesRouter } from "./routes/evaluaciones.router";
import { createEstudiantesRouter } from "./routes/estudiantes.router"
import { createDocentesRouter } from "./routes/docentes.router"
import { createEncargadosRouter } from "./routes/encargado-zona.router";
import { createDirectivosRouter } from "./routes/directivos.router"
import { createEscuelasRouter } from "./routes/escuelas.router";
import { createAulasRouter } from "./routes/aulas.router";
import { createZonasRouter } from "./routes/zonas.router";
import authRouter from "./routes/auth.router";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  //app.use("/evaluaciones", evaluacionesRouter);
  app.use(createHealthRouter());
  app.use(createEvaluacionesRouter());
  app.use(createEstudiantesRouter());
  app.use(createDocentesRouter());
  app.use(createDirectivosRouter());
  app.use(createEncargadosRouter());
  app.use(createEscuelasRouter());
  app.use(createAulasRouter());
  app.use(createZonasRouter());
  app.use(cors({
  origin: [
    'https://fundacionpadi-41cb2.web.app',
    'https://fundacionpadi-41cb2.firebaseapp.com',
    'http://localhost:5173' // Para que sigas pudiendo probar en local
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
  app.use("/auth", authRouter);

  return app;
}


