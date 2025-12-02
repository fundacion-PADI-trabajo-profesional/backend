import type { Request, Response } from "express";
import { DirectivosService } from "../services/directivos.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new DirectivosService();

export async function listDirectivos(_req: Request, res: Response) {
    try {
        const data = await service.list();
        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al listar directivos";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

export async function assignEscuelaToDirectivo(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { escuela_id, usuario_id, rol } = req.body;

        if (!id || !escuela_id || !usuario_id || !rol) {
            return res.status(400).json(
                commonResponse(false, "Faltan datos obligatorios", null, {
                    code: "VALIDATION_ERROR",
                }),
            );
        }

        const user = {
            id: String(usuario_id),
            rol: String(rol),
        };

        const data = await service.assignEscuela(String(id), String(escuela_id), user);

        return res
            .status(200)
            .json(commonResponse(true, "Escuela asignada al directivo", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al asignar escuela a directivo";
        res
            .status(400)
            .json(
                commonResponse(false, message, null, {
                    code: "ASSIGN_SCHOOL_ERROR",
                    description: message,
                }),
            );
    }
}


