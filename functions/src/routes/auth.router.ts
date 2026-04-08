import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

// Rutas PUBLICAS de autenticación (sin JWT requerido)
export function createAuthRouter() {
    const router = Router();

    router.post("/auth/login", AuthController.login);
    router.post("/auth/register", AuthController.register);
    router.post("/auth/refresh-token", AuthController.refreshToken);
    router.post("/auth/reset-password-request", AuthController.requestPasswordReset);
    router.post("/auth/update-password", AuthController.updatePassword);

    return router;
}

// Rutas PROTEGIDAS de autenticación (requieren JWT válido)
export function createAuthProtectedRouter() {
    const router = Router();

    router.put("/auth/profile", AuthController.updateProfile);

    return router;
}
