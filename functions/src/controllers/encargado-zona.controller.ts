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

export async function updateEncargado(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, apellido, email, zona_id } = req.body;

        if (!id || !nombre || !apellido || !zona_id) {
            return res.status(400).json(commonResponse(false, "Faltan datos obligatorios para actualizar", null));
        }

        const result = await service.update(id, { nombre, apellido, email, zona_id });
        res.status(200).json(commonResponse(true, "Encargado actualizado con éxito", result));
    } catch (error: any) {
        res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function deleteEncargado(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json(commonResponse(false, "ID de encargado no proporcionado", null));
        }

        await service.delete(id);
        res.status(200).json(commonResponse(true, "Encargado eliminado con éxito", null));
    } catch (error: any) {
        const message = error?.message || "Error al eliminar encargado";
        res.status(400).json(commonResponse(false, message, null, { code: "DELETE_ERROR", description: message }));
    }
}