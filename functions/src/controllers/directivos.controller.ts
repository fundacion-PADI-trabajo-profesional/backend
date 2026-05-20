import type { Request, Response } from "express";
import { DirectivosService } from "../services/directivos.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const service = new DirectivosService();

/**
 * Lista todos los directivos registrados en el sistema.
 *
 * `GET /directivos`
 *
 * @param req - Request autenticado. El rol del usuario determina el alcance del listado.
 * @param res - `200` con el array de directivos, `500` si ocurre un error interno.
 */
export async function listDirectivos(req: AuthenticatedRequest, res: Response) {
    try {
        const data = await service.list({
            id: req.user!.id,
            rol: req.user!.rol,
        });
        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al listar directivos";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

/**
 * Lista los directivos que aún no tienen escuela asignada.
 *
 * @remarks
 * Usado por el frontend para poblar el selector al asignar un directivo a una escuela.
 *
 * `GET /directivos/disponibles`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de directivos disponibles, `500` si ocurre un error interno.
 */
export async function listDirectivosDisponibles(req: AuthenticatedRequest, res: Response) {
    try {
        const data = await service.listAvailable({
            id: req.user!.id,
            rol: req.user!.rol,
        });
        res.status(200).json(commonResponse(true, "Directivos disponibles", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al listar directivos disponibles";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

/**
 * Asigna una escuela a un directivo.
 *
 * `POST /directivos/:id/asignar-escuela`
 *
 * @param req - Request autenticado. Param: `id` del directivo. Body: `{ escuela_id }`.
 * @param res - `200` con la relación creada, `400` si faltan datos o la asignación falla.
 */
export async function assignEscuelaToDirectivo(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { escuela_id } = req.body;

        //Validación de datos de entrada
        if (!id || !escuela_id) {
            return res.status(400).json(
                commonResponse(false, "Faltan datos obligatorios", null, {
                    code: "VALIDATION_ERROR",
                }),
            );
        }

        //Obtenemos el usuario que realiza la acción desde el middleware
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        };

        const data = await service.assignEscuela(String(id), String(escuela_id), user);

        return res
            .status(200)
            .json(commonResponse(true, "Escuela asignada al directivo", data));

    } catch (error: any) {
        const message = error?.message || "Error interno al asignar escuela a directivo";
        return res
            .status(400)
            .json(
                commonResponse(false, message, null, {
                    code: "ASSIGN_SCHOOL_ERROR",
                    description: message,
                }),
            );
    }
}


