import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminService, type CreateUserData } from "../services/admin.service";

export class AdminController {
  /**
   * Crea un único usuario desde el panel admin.
   * POST /admin/users
   * Body: { nombre, apellido, email, rol }
   */
  static async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { nombre, apellido, email, rol } = req.body;

      if (!nombre || !apellido || !email || !rol) {
        return res.status(400).json({
          message: "Todos los campos son obligatorios: nombre, apellido, email y rol.",
        });
      }

      const newUser = await AdminService.createUser({ nombre, apellido, email, rol });

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
   * Crea múltiples usuarios en lote.
   * POST /admin/users/bulk
   * Body: { users: [{ nombre, apellido, email, rol }, ...] }
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
   * Lista todos los usuarios.
   * GET /admin/users
   */
  static async listUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await AdminService.listUsers();
      return res.status(200).json(users);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message });
    }
  }

  /**
   * Elimina un usuario.
   * DELETE /admin/users/:id
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
