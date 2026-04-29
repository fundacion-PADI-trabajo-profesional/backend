import type { Response } from "express";
import { EncargadosService } from "../services/encargado-zona.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";


const service = new EncargadosService();

/**
 * Lista todos los encargados de zona registrados en el sistema.
 *
 * `GET /encargados`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de encargados, `500` si ocurre un error interno.
 */
export async function listEncargados(req: AuthenticatedRequest, res: Response) {
    try {
        const data = await service.list({
            id: req.user!.id,
            rol: req.user!.rol,
        });
        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al listar encargados";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

/**
 * Crea un nuevo encargado de zona y le envía un correo de invitación.
 *
 * `POST /encargados`
 *
 * @param req - Request autenticado. Body: `{ email, nombre, apellido, zona }`.
 * @param res - `201` con el encargado creado, `400` si faltan datos o el email ya existe.
 */
export async function createEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const { email, nombre, apellido, zona } = req.body;
        const user = { id: req.user!.id, rol: req.user!.rol };

        if (!email || !nombre || !apellido || !zona) {
            return res.status(400).json(commonResponse(false, "Faltan datos obligatorios", null));
        }

        // Pasamos el 'user' al servicio por si necesitas validar permisos de zona
        const result = await service.create({ email, nombre, apellido, zona }, user);

        return res.status(201).json(commonResponse(true, "Encargado invitado con éxito", result));
    } catch (error: any) {
        const message = error?.message || "Error al crear encargado";
        res
            .status(400)
            .json(commonResponse(false, message, null, { code: "CREATE_ERROR", description: message }));
    }
}

/**
 * Actualiza los datos de un encargado de zona existente.
 *
 * `PUT /encargados/:id`
 *
 * @param req - Request autenticado. Param: `id`. Body: `{ nombre, apellido, email, zona_id }`.
 * @param res - `200` con el encargado actualizado, `403` sin permisos, `400` si faltan datos.
 */
export async function updateEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, apellido, email, zona_id } = req.body;
        const user = { id: req.user!.id, rol: req.user!.rol };

        if (!id || !nombre || !apellido || !zona_id) {
            return res.status(400).json(commonResponse(false, "Faltan datos obligatorios para actualizar", null));
        }

        const result = await service.update(id, { nombre, apellido, email, zona_id }, user);
        res.status(200).json(commonResponse(true, "Encargado actualizado con éxito", result));
    } catch (error: any) {
        const statusCode = error.message.includes("permisos") ? 403 : 400;
        res.status(statusCode).json(commonResponse(false, error.message, null));
    }
}

/**
 * Retorna los datos del encargado de zona actualmente autenticado.
 *
 * @remarks
 * Usado por el frontend para cargar el perfil del encargado en su dashboard.
 * El `userId` se obtiene del token JWT, no de parámetros de URL.
 *
 * `GET /encargados/me`
 *
 * @param req - Request autenticado.
 * @param res - `200` con los datos del encargado, `500` si ocurre un error.
 */
export async function getCurrentEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const userId = req.user!.id;

        if (!userId) {
            return res.status(400).json(commonResponse(false, "ID de usuario requerido", null));
        }

        const data = await service.getCurrentEncargado(String(userId));
        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error?.message || "Error al obtener información del encargado";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

/**
 * Elimina un encargado de zona del sistema.
 *
 * `DELETE /encargados/:id`
 *
 * @param req - Request autenticado. Param: `id` del encargado.
 * @param res - `200` si fue eliminado, `403` sin permisos, `400` si falta el ID.
 */
export async function deleteEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const user = { id: req.user!.id, rol: req.user!.rol };

        if (!id) {
            return res.status(400).json(commonResponse(false, "ID de encargado no proporcionado", null));
        }

        await service.delete(id, user);
        res.status(200).json(commonResponse(true, "Encargado eliminado con éxito", null));
    } catch (error: any) {
        const statusCode = error.message.includes("permisos") ? 403 : 400;
        res.status(statusCode).json(commonResponse(false, error.message, null));
    }
}
