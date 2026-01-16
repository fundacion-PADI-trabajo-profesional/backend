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

export async function updateEscuela(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, direccion, telefono, zona_id } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(commonResponse(false, "Nombre y Zona son obligatorios", null));
        }

        const result = await service.update(id, { nombre, direccion, telefono, zona_id });
        res.status(200).json(commonResponse(true, "Institución actualizada", result));
    } catch (error: any) {
        res.status(400).json(commonResponse(false, error.message, null));
    }
}

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

export async function addDirectivoToEscuela(req: Request, res: Response) {
    try {
        const { escuelaId, usuarioId } = req.body;
        await service.addDirectivo(escuelaId, usuarioId);
        res.status(200).json(commonResponse(true, "Directivo asignado correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al asignar directivo", null));
    }
}

export async function removeDirectivoFromEscuela(req: Request, res: Response) {
    try {
        const { usuarioId } = req.body;
        await service.removeDirectivo(usuarioId);
        res.status(200).json(commonResponse(true, "Directivo removido correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al remover directivo", null));
    }
}

export async function deleteEscuela(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { rol, usuario_id } = req.query;

        const user = {
            id: String(usuario_id),
            rol: String(rol)
        };

        await service.delete(id, user);
        res.status(200).json(commonResponse(true, "Escuela eliminada correctamente. Todos los vínculos han sido liberados.", null));
    } catch (error: any) {
        const message = error.message || "Error interno al eliminar escuela";
        console.error("[deleteEscuela] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "DELETE_ERROR", description: message }));
    }
}