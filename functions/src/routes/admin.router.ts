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

  // Rutas EXCLUSIVAS para equipo_padi (le pasamos el middleware individualmente a cada una)
  router.get("/admin/users", requireRole("equipo_padi") as any, AdminController.listUsers as any);
  router.post("/admin/users/bulk", requireRole("equipo_padi") as any, AdminController.createUsersBulk as any);
  router.post("/admin/users/:id/resend-invite", requireRole("equipo_padi") as any, AdminController.resendInvite as any);
  router.patch("/admin/users/:id/rol", requireRole("equipo_padi") as any, AdminController.updateUserRol as any);
  router.delete("/admin/users/:id", requireRole("equipo_padi") as any, AdminController.deleteUser as any);

  // equipo_padi, encargado_zona y director pueden crear usuarios (solo docentes para los dos últimos, según matriz)
  router.post("/admin/users", requireRole("equipo_padi", "encargado_zona", "director") as any, AdminController.createUser as any);
  return router;
}
