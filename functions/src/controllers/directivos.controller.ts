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


