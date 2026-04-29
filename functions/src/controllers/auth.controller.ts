import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Controlador HTTP para las operaciones de autenticación.
 *
 * @remarks
 * Los métodos `login`, `register`, `refreshToken`, `requestPasswordReset` y `updatePassword`
 * son públicos (no requieren token JWT). `updateProfile` requiere token válido y que el usuario se encuentre 
 * autenticado.
 */
export class AuthController {
  /**
   * Autentica un usuario con email y contraseña.
   *
   * `POST /auth/login`
   *
   * @param req - Body: `{ email, password }`.
   * @param res - `200` con `{ accessToken, refreshToken, user }`, `401` si las credenciales son inválidas.
   */
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

  /**
   * Registra un nuevo usuario en el sistema.
   *
   *
   * `POST /auth/register`
   *
   * @param req - Body: `{ email, password, nombre, apellido, rol }`.
   * @param res - `201` con los datos del usuario creado, `400` si el email ya existe o los datos son inválidos.
   */
  static async register(req: Request, res: Response) {
    try {
      const authData = await AuthService.register(req.body);
      res.status(201).json(authData); // 201 Created
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message }); // 400 Bad Request
    }
  }

  /**
   * Renueva el access token usando un refresh token válido.
   *
   * `POST /auth/refresh`
   *
   * @param req - Body: `{ refreshToken }`.
   * @param res - `200` con `{ accessToken, refreshToken }`, `401` si el refresh token es inválido o expiró.
   */
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

  /**
   * Actualiza el nombre y apellido del perfil del usuario autenticado.
   *
   * @remarks
   * El `userId` siempre se obtiene del token JWT, nunca del body, para evitar
   * que un usuario modifique el perfil de otro.
   *
   * `PUT /auth/profile`
   *
   * @param req - Request autenticado. Body: `{ nombre, apellido }`.
   * @param res - `200` con el perfil actualizado, `400` si faltan campos.
   */
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

  /**
   * Envía un correo de restablecimiento de contraseña al email indicado.
   *
   * @remarks
   * Si el email no existe en el sistema, la respuesta es igualmente exitosa
   * para evitar enumeración de usuarios.
   *
   * `POST /auth/reset-password-request`
   *
   * @param req - Body: `{ email }`.
   * @param res - `200` confirmando el envío, `400` si falta el email.
   */
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

  /**
   * Establece una nueva contraseña usando los tokens del link de restablecimiento.
   *
   * @remarks
   * El link de restablecimiento enviado por email incluye `accessToken` y `refreshToken`
   * como parámetros de URL. El frontend los extrae y los envía en el body de este endpoint.
   *
   * `POST /auth/update-password`
   *
   * @param req - Body: `{ accessToken, refreshToken, newPassword }`.
   * @param res - `200` si la contraseña fue actualizada, `400` si faltan tokens o la nueva contraseña es inválida.
   */
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