import type { Request, Response } from "express";
import { EncargadosService } from "../services/encargado-zona.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new EncargadosService();

export async function listEncargados(_req: Request, res: Response) {
    try {
        const data = await service.list();
        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error?.message || "Error interno al listar encargados";
        res
            .status(500)
            .json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

export async function createEncargado(req: Request, res: Response) {
    try {
        // Ya no extraemos password del body
        const { email, nombre, apellido, zona } = req.body;

        // Validación: No pedimos password
        if (!email || !nombre || !apellido || !zona) {
            res.status(400).json(commonResponse(false, "Faltan datos obligatorios (email, nombre, apellido, zona)", null));
            return;
        }

        const result = await service.create({ email, nombre, apellido, zona });

        res.status(201).json(commonResponse(true, "Encargado invitado con éxito", result));
    } catch (error: any) {
        const message = error?.message || "Error al crear encargado";
        res
            .status(400)
            .json(commonResponse(false, message, null, { code: "CREATE_ERROR", description: message }));
    }
}