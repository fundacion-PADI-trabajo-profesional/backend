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
import { createAuthRouter, createAuthProtectedRouter } from "./routes/auth.router";
import { requireAuth } from "./middlewares/auth.middleware";

export function createApp() {
  const app = express();

  // Orígenes permitidos: frontend local en desarrollo + producción en Firebase Hosting
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permitir requests sin origin (ej: Postman, curl, apps móviles)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origen no permitido — ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };

  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());

  // Rutas PUBLICAS (sin autenticacion)
  app.use(createHealthRouter());
  app.use(createAuthRouter());

  // A partir de acá, TODAS las rutas requieren JWT válido
  app.use(requireAuth as any);

  // RUTAS PROTEGIDAS
  app.use(createAuthProtectedRouter());
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
