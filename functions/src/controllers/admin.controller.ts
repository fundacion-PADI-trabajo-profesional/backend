import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminService, type CreateUserData } from "../services/admin.service";

/**
 * Controlador HTTP para las operaciones del panel de administración de usuarios del sistema.
 *
 * @remarks
 * Todos los métodos requieren que el solicitante esté autenticado con rol `admin`.
 * La autorización es verificada por el middleware antes de llegar a este controlador.
 */
export class AdminController {
  /**
   * Crea un único usuario desde el panel de administración.
   *
   * @remarks
   * El sistema genera una contraseña temporal y envía un correo de invitación
   * al email indicado. El usuario deberá cambiar la contraseña en su primer inicio de sesión.
   *
   * `POST /admin/users`
   *
   * @param req - Request autenticado. Body: `{ nombre, apellido, email, rol }`.
   * @param res - `201` con el usuario creado, `400` si faltan campos o el email ya existe.
   */
  static async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { nombre, apellido, email, rol } = req.body;
      const solicitanteRol = req.user?.rol;

      if (!nombre || !apellido || !email || !rol) {
        return res.status(400).json({
          message: "Todos los campos son obligatorios: nombre, apellido, email y rol.",
        });
      }

      const rolesPermitidos = ["equipo_padi", "encargado_zona", "director"];
      if (!solicitanteRol || !rolesPermitidos.includes(solicitanteRol)) {
        return res.status(403).json({ message: "No tenés permisos para crear usuarios." });
      }

      // Si el que crea NO es equipo_padi, entonces SOLO puede crear docentes.
      if (solicitanteRol !== "equipo_padi" && rol !== "docente") {
        return res.status(403).json({ message: "Solo tenés permisos para crear cuentas de docentes." });
      }

      // Si el solicitante es director, asignar el nuevo docente a su escuela automáticamente.
      const escuela_id = solicitanteRol === "director" ? req.user?.escuela_id : undefined;

      const newUser = await AdminService.createUser({ nombre, apellido, email, rol, escuela_id });

      return res.status(201).json({
        message: `Usuario creado exitosamente. Se envió un correo con la contraseña temporal a ${email}.`,
        user: newUser,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ message });
    }
  }

  /**
   * Crea múltiples usuarios en lote desde el panel de administración.
   *
   * @remarks
   * Procesa el array completo e intenta crear cada usuario individualmente.
   * Los errores parciales no abortan el proceso: se reportan en el campo `errores`
   * junto con los usuarios creados exitosamente en `creados`.
   * Si todos fallan responde `400`; si al menos uno se crea, responde `200`.
   *
   * `POST /admin/users/bulk`
   *
   * @param req - Request autenticado. Body: `{ users: CreateUserData[] }`.
   * @param res - `200` con resultado parcial o total, `400` si el array está vacío o todos fallaron.
   */
  static async createUsersBulk(req: AuthenticatedRequest, res: Response) {
    try {
      const { users } = req.body;

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          message: "Se requiere un array 'users' con al menos un usuario.",
        });
      }

      const result = await AdminService.createUsersBulk(users as CreateUserData[]);

      const status = result.errores.length > 0 && result.creados.length === 0 ? 400 : 200;

      return res.status(status).json({
        message: `Proceso completado: ${result.creados.length} usuario(s) creado(s), ${result.errores.length} error(es).`,
        creados: result.creados,
        errores: result.errores,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ message });
    }
  }

  /**
   * Lista todos los usuarios del sistema.
   *
   * `GET /admin/users`
   *
   * @param req - Request autenticado. Sin parámetros adicionales.
   * @param res - `200` con el array de usuarios, `500` si ocurre un error interno.
   */
  static async listUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage ?? "50"), 10) || 50));
      const users = await AdminService.listUsers(page, perPage);
      return res.status(200).json(users);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message });
    }
  }

  /**
   * Reenvía el correo de invitación a un usuario pendiente de activación.
   *
   * @remarks
   * Utilizado cuando el usuario no encontró el correo original o el link expiró.
   *
   * `POST /admin/users/:id/resend-invite`
   *
   * @param req - Request autenticado. Param: `id` del usuario.
   * @param res - `200` si el correo fue reenviado, `400` si falta el ID o el usuario no existe.
   */
  static async resendInvite(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "Se requiere el ID del usuario." });
      }

      await AdminService.resendInvite(id);

      return res.status(200).json({ message: "Invitación reenviada exitosamente." });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ message });
    }
  }

  /**
   * Cambia el rol de un usuario existente.
   *
   * `PATCH /admin/users/:id/rol`
   *
   * @param req - Request autenticado. Param: `id` del usuario. Body: `{ rol }`.
   * @param res - `200` con el usuario actualizado, `400` si hay error de validación.
   */
  static async updateUserRol(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol } = req.body;

      if (!id) return res.status(400).json({ message: "Se requiere el ID del usuario." });
      if (!rol) return res.status(400).json({ message: "Se requiere el nuevo rol." });

      if (req.user?.id === id) {
        return res.status(400).json({ message: "No podés cambiar tu propio rol." });
      }

      const result = await AdminService.updateUserRol(id, rol);
      return res.status(200).json({ success: true, message: "Rol actualizado correctamente.", data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ message });
    }
  }

  /**
   * Elimina un usuario del sistema.
   *
   * @remarks
   * Un administrador no puede eliminarse a sí mismo: si el `id` del param coincide
   * con el `id` del token autenticado, la operación es rechazada con `400`.
   *
   * `DELETE /admin/users/:id`
   *
   * @param req - Request autenticado. Param: `id` del usuario a eliminar.
   * @param res - `200` si fue eliminado, `400` si falta el ID o el admin intenta auto-eliminarse.
   */
  static async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "Se requiere el ID del usuario." });
      }

      // Un admin no puede borrarse a sí mismo
      if (req.user?.id === id) {
        return res.status(400).json({ message: "No podés eliminar tu propia cuenta." });
      }

      await AdminService.deleteUser(id);

      return res.status(200).json({ message: "Usuario eliminado exitosamente." });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ message });
    }
  }
}
