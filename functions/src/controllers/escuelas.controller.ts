import { Request, Response } from "express";
import { EscuelasService } from "../services/escuelas.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AulasService } from "../services/aulas.service";

const service = new EscuelasService();
const aulasService = new AulasService();

// GET /api/escuelas
export async function listEscuelas(req: AuthenticatedRequest, res: Response) {
    try {

        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };

        const data = await service.list(user);
        res.status(200).json(commonResponse(true, "Listado de escuelas obtenido", data));
    } catch (error: any) {
        const message = error.message || "Error interno al listar escuelas";
        console.error("[listEscuelas] Error:", error);
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

export async function updateEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, direccion, telefono, zona_id } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(commonResponse(false, "Nombre y Zona son obligatorios", null));
        }

        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };
        const result = await service.update(id, { nombre, direccion, telefono, zona_id }, user);

        res.status(200).json(commonResponse(true, "Institución actualizada", result));
    } catch (error: any) {
        res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function createEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { nombre, direccion, telefono, zona_id } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(
                commonResponse(false, "Faltan datos obligatorios (nombre o zona)", null, { code: "VALIDATION_ERROR" })
            );
        }

        const user = { id: req.user!.id, rol: req.user!.rol };
        const data = await service.create({ nombre, direccion, telefono, zona_id }, user);

        try {
            const salasPorDefecto = [3, 4, 5];
            for (const salaId of salasPorDefecto) {
                await aulasService.create({
                    sala_id: salaId,
                    comision: "Única",
                    turno: "Mañana", 
                    escuela_id: data.id 
                }, user);
            }
        } catch (aulasError) {
            console.error("[createEscuela] Aviso: La escuela se creó pero fallaron las aulas por defecto", aulasError);
        }

        res.status(201).json(commonResponse(true, "Escuela creada con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error interno al crear escuela";
        console.error("[createEscuela] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "CREATE_ERROR", description: message }));
    }
}

export async function addDirectivoToEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { escuelaId, usuarioId } = req.body;
        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };
        await service.addDirectivo(escuelaId, usuarioId, user);
        res.status(200).json(commonResponse(true, "Directivo asignado correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al asignar directivo", null));
    }
}

export async function removeDirectivoFromEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { usuarioId } = req.body;
        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };
        await service.removeDirectivo(usuarioId, user);
        res.status(200).json(commonResponse(true, "Directivo removido correctamente", null));
    } catch (error: any) {
        res.status(500).json(commonResponse(false, "Error al remover directivo", null));
    }
}

export async function deleteEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;

        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };

        await service.delete(id, user);
        res.status(200).json(commonResponse(true, "Escuela eliminada correctamente. Todos los vínculos han sido liberados.", null));
    } catch (error: any) {
        const message = error.message || "Error interno al eliminar escuela";
        console.error("[deleteEscuela] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "DELETE_ERROR", description: message }));
    }
}