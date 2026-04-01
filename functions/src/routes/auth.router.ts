import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.put("/profile", AuthController.updateProfile);
router.post("/reset-password-request", AuthController.requestPasswordReset);
router.post("/update-password", AuthController.updatePassword);

export default router;