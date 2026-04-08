import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export function createAuthRouter() {
    const router = Router();

    router.post("/auth/login", AuthController.login);
    router.post("/auth/register", AuthController.register);
    router.post("/auth/refresh-token", AuthController.refreshToken);
    router.put("/auth/profile", AuthController.updateProfile);
    router.post("/auth/reset-password-request", AuthController.requestPasswordReset);
    router.post("/auth/update-password", AuthController.updatePassword);

    return router;
}
