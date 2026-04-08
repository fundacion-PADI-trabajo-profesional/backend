import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const authData = await AuthService.login(email, password);
      res.status(200).json(authData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(401).json({ message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const authData = await AuthService.register(req.body);
      res.status(201).json(authData); // 201 Created
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message }); // 400 Bad Request
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new Error("Refresh token es requerido.");
      }

      const tokens = await AuthService.refreshSession(refreshToken);
      res.status(200).json(tokens);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(401).json({ message });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      // Siempre usamos el ID del token — nunca del body (evita modificar perfiles ajenos)
      const userId = req.user!.id;
      const { nombre, apellido } = req.body;

      if (!nombre || !apellido) {
        throw new Error("Nombre y apellido son obligatorios.");
      }

      const updatedProfile = await AuthService.updateProfile(userId, nombre, apellido);
      res.status(200).json({ message: "Perfil actualizado con éxito", profile: updatedProfile });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message });
    }
  }

  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        throw new Error("El correo electrónico es obligatorio.");
      }

      const response = await AuthService.sendPasswordResetEmail(email);
      res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message });
    }
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const { accessToken, refreshToken, newPassword } = req.body;

      if (!accessToken || !refreshToken || !newPassword) {
        throw new Error("Faltan datos de seguridad para actualizar la contraseña.");
      }

      const response = await AuthService.updatePassword(accessToken, refreshToken, newPassword);
      res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message });
    }
  }

}