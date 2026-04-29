import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { requireRole } from "../middlewares/auth.middleware";

/**
 * Crea el router del panel de administración.
 *
 * @remarks
 * **Todas** las rutas de este router requieren el rol `"equipo_padi"`, aplicado
 * como middleware global del router (`router.use`). El JWT ya fue validado
 * previamente por `requireAuth` en el entry point de la aplicación.
 *
 * Rutas expuestas:
 * - `GET  /admin/users` — lista todos los usuarios del sistema.
 * - `POST /admin/users` — crea un usuario individual (envía invitación por email).
 * - `POST /admin/users/bulk` — crea múltiples usuarios desde una importación.
 * - `POST /admin/users/:id/resend-invite` — reenvía la invitación a un usuario existente.
 * - `DELETE /admin/users/:id` — elimina un usuario del sistema.
 *
 * @returns Router de Express configurado con las rutas de administración.
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
