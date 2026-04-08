import type { Request, Response } from "express";
import { DirectivosService } from "../services/directivos.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const service = new DirectivosService();

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

        // 4. Llamada al servicio pasando el 'user' (quien ejecuta) y los datos del target
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


