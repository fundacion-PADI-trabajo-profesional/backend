import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

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

    router.post("/auth/login", AuthController.login);
    router.post("/auth/register", AuthController.register);
    router.post("/auth/refresh-token", AuthController.refreshToken);
    router.post("/auth/reset-password-request", AuthController.requestPasswordReset);
    router.post("/auth/update-password", AuthController.updatePassword);

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
