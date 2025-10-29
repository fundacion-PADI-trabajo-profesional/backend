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
      // Aquí se podría añadir validación de datos con Zod o express-validator
      const authData = await AuthService.register(req.body);
      res.status(201).json(authData); // 201 Created
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message }); // 400 Bad Request
    }
  }
}