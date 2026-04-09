import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Rutas del panel de administración.
 * TODAS requieren rol equipo_padi (además del JWT del middleware global).
 */
export function createAdminRouter() {
  const router = Router();

  // Middleware de rol para todas las rutas de este router
  router.use(requireRole("equipo_padi") as any);

  router.get("/admin/users", AdminController.listUsers as any);
  router.post("/admin/users", AdminController.createUser as any);
  router.post("/admin/users/bulk", AdminController.createUsersBulk as any);
  router.post("/admin/users/:id/resend-invite", AdminController.resendInvite as any);
  router.delete("/admin/users/:id", AdminController.deleteUser as any);

  return router;
}
