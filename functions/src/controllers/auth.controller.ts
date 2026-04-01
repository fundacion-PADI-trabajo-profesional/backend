import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

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

  static async updateProfile(req: Request, res: Response) {
    try {
      const { userId, nombre, apellido } = req.body;

      if (!userId || !nombre || !apellido) {
        throw new Error("Faltan datos obligatorios para actualizar el perfil.");
      }

      const updatedProfile = await AuthService.updateProfile(userId, nombre, apellido);
      res.status(200).json({ message: "Perfil actualizado con éxito", profile: updatedProfile });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message });
    }
  }
}