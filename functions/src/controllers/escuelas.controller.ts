import { Request, Response } from "express";
import { EscuelasService } from "../services/escuelas.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new EscuelasService();

// GET /api/escuelas
export async function listEscuelas(req: Request, res: Response) {
    try {
        const { usuario_id, rol } = req.query;

        if (!usuario_id || !rol) {
            console.log("Faltan datos de usuario en la petición");
        }

        const user = {
            id: String(usuario_id),
            rol: String(rol)
        };

        const data = await service.list(user);
        res.status(200).json(commonResponse(true, "Listado de escuelas obtenido", data));
    } catch (error: any) {
        const message = error.message || "Error interno al listar escuelas";
        console.error("[listEscuelas] Error:", error);
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

// POST /api/escuelas
export async function createEscuela(req: Request, res: Response) {
    try {
        const { nombre, direccion, telefono, zona_id, usuario_id, rol } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(
                commonResponse(false, "Faltan datos obligatorios (nombre o zona)", null, { code: "VALIDATION_ERROR" })
            );
        }

        const user = {
            id: usuario_id,
            rol: rol
        };

        const data = await service.create({ nombre, direccion, telefono, zona_id }, user);

        res.status(201).json(commonResponse(true, "Escuela creada con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error interno al crear escuela";
        console.error("[createEscuela] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "CREATE_ERROR", description: message }));
    }
}

export async function addDocenteToEscuela(req: Request, res: Response) {
    try {
        const { escuelaId, profesorId } = req.body;
        await service.addDocente(escuelaId, profesorId);
        res.status(200).json(commonResponse(true, "Docente asignado correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al asignar docente", null));
    }
}

export async function removeDocenteFromEscuela(req: Request, res: Response) {
    try {
        const { escuelaId, profesorId } = req.body;
        await service.removeDocente(escuelaId, profesorId);
        res.status(200).json(commonResponse(true, "Docente removido correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al remover docente", null));
    }
}