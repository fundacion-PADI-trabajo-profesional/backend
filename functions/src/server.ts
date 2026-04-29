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
import { createAdminRouter } from "./routes/admin.router";
import { requireAuth } from "./middlewares/auth.middleware";

/**
 * Fábrica de la aplicación Express.
 * * @remarks
 * Este módulo centraliza la configuración de middlewares globales y el montaje 
 * jerárquico de rutas. El orden de los middlewares es crítico:
 * 1. **CORS:** Gestión de orígenes permitidos (Local, Staging, Producción).
 * 2. **Body Parser:** Parseo de JSON para habilitar `req.body`.
 * 3. **Public Routes:** Rutas de salud y autenticación inicial.
 * 4. **Auth Middleware:** Barrera de seguridad JWT para el resto de la API.
 * * @returns Instancia de Express configurada y lista para montar en un servidor o función.
 */
export function createApp() {
  const app = express();

  /**
   * Configuración dinámica de CORS.
   * Permite peticiones desde entornos locales de desarrollo y dominios oficiales de Firebase Hosting.
   * Filtra valores nulos para evitar errores en el despliegue si `FRONTEND_URL` no está definida.
   */
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://fundacionpadi-41cb2.web.app",
    "https://fundacionpadi-41cb2.firebaseapp.com",
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

  // Middlewares Globales
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());

  /**
   * Rutas de acceso público.
   * No requieren cabecera 'Authorization'.
   */
  app.use(createHealthRouter());
  app.use(createAuthRouter());

  // A partir de acá, TODAS las rutas requieren JWT válido
  app.use(requireAuth as any);

  /**
   * Rutas Protegidas.
   * Solo accesibles para usuarios autenticados. La lógica de autorización 
   * específica por rol se maneja dentro de cada servicio/controller.
   */
  app.use(createAuthProtectedRouter());
  app.use(createEvaluacionesRouter());
  app.use(createEstudiantesRouter());
  app.use(createDocentesRouter());
  app.use(createDirectivosRouter());
  app.use(createEncargadosRouter());
  app.use(createEscuelasRouter());
  app.use(createAulasRouter());
  app.use(createZonasRouter());
  app.use(createAdminRouter());

  return app;
}
