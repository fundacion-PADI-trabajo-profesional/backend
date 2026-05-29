import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { ip: false }, // req.ip es undefined en Firebase Cloud Functions
  keyGenerator: (req) =>
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim()
    ?? req.socket?.remoteAddress
    ?? "unknown",
  message: { message: "Demasiados intentos. Intentá de nuevo en 15 minutos." },
});

/**
 * Crea el router de autenticación con rutas **públicas** (sin JWT requerido).
 *
 * @remarks
 * Rutas expuestas:
 * - `POST /auth/login` — inicio de sesión con email y contraseña.
 * - `POST /auth/register` — registro de nuevos usuarios.
 * - `POST /auth/refresh-token` — renovación del token de acceso.
 * - `POST /auth/reset-password-request` — solicita el envío del email de recuperación.
 * - `POST /auth/update-password` — actualiza la contraseña usando el token de recuperación.
 *
 * @returns Router de Express con las rutas públicas de autenticación.
 */
export function createAuthRouter() {
    const router = Router();

    router.post("/auth/login", authLimiter, AuthController.login);
    router.post("/auth/register", authLimiter, AuthController.register);
    router.post("/auth/refresh-token", authLimiter, AuthController.refreshToken);
    router.post("/auth/reset-password-request", authLimiter, AuthController.requestPasswordReset);
    router.post("/auth/update-password", authLimiter, AuthController.updatePassword);

    return router;
}

/**
 * Crea el router de autenticación con rutas **protegidas** (requieren JWT válido).
 *
 * @remarks
 * Rutas expuestas:
 * - `PUT /auth/profile` — actualiza nombre y apellido del usuario autenticado.
 *
 * Este router se registra detrás del middleware `requireAuth` en el entry point
 * principal de la aplicación.
 *
 * @returns Router de Express con las rutas protegidas de autenticación.
 */
export function createAuthProtectedRouter() {
    const router = Router();

    router.put("/auth/profile", AuthController.updateProfile);

    return router;
}
