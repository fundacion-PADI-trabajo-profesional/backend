import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ZonasService } from "../services/zonas.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new ZonasService();

export async function createZona(req: AuthenticatedRequest, res: Response) {
    try {
        const { nombre } = req.body;
        const rol = req.user!.rol
        const data = await service.create({ nombre }, { rol: String(rol) });
        return res.status(201).json(commonResponse(true, "Zona creada", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function listZonas(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.list({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function getZona(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const rol = req.user!.rol
        const data = await service.getDetails(id, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(404).json(commonResponse(false, error.message, null));
    }
}

export async function addEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params; // ID de la zona
        const { escuelaId } = req.body;
        const rol = req.user!.rol
        const data = await service.assignEscuela(id, escuelaId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Escuela asignada", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function listEscuelasDisponibles(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEscuelasDisponibles({ rol: String(rol) });

        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function removeEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { escuelaId } = req.params;
        const rol = req.user!.rol

        const data = await service.removeEscuelaFromZona(escuelaId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Escuela desvinculada", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function updateZona(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        const rol = req.user!.rol;

        const data = await service.update(id, { nombre }, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Zona actualizada con éxito", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}


export async function listEncargadosSinZona(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEncargadosDisponibles({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function listEncargados(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEncargados({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function addEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params; // ID de la zona
        const { encargadoId } = req.body;
        const rol = req.user!.rol;
        const data = await service.assignEncargadoToZona(id, encargadoId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Encargado asignado con éxito", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function removeEncargado(req: AuthenticatedRequest, res: Response) {
    try {
        const { encargadoId } = req.params;
        const rol = req.user!.rol;

        const data = await service.removeEncargadoFromZona(encargadoId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Encargado desvinculado", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}