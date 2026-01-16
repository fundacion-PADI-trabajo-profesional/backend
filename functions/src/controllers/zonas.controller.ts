import type { Request, Response } from "express";
import { ZonasService } from "../services/zonas.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new ZonasService();

export async function createZona(req: Request, res: Response) {
    try {
        const { nombre, rol } = req.body;
        const data = await service.create({ nombre }, { rol: String(rol) });
        return res.status(201).json(commonResponse(true, "Zona creada", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function listZonas(req: Request, res: Response) {
    try {
        const { rol } = req.query; // En GET los datos suelen venir por query
        const data = await service.list({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function getZona(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { rol } = req.query;
        const data = await service.getDetails(id, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(404).json(commonResponse(false, error.message, null));
    }
}

export async function addEscuela(req: Request, res: Response) {
    try {
        const { id } = req.params; // ID de la zona
        const { escuelaId, rol } = req.body;
        const data = await service.assignEscuela(id, escuelaId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Escuela asignada", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function listEscuelasDisponibles(req: Request, res: Response) {
    try {
        const { rol } = req.query;
        const data = await service.getEscuelasDisponibles({ rol: String(rol) });

        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function removeEscuela(req: Request, res: Response) {
    try {
        const { escuelaId } = req.params;
        const { rol } = req.body; // El rol viene del body en el POST/PUT

        const data = await service.removeEscuelaFromZona(escuelaId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Escuela desvinculada", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function updateZona(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, rol } = req.body;

        const data = await service.update(id, { nombre }, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Zona actualizada con éxito", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}


export async function listEncargadosSinZona(req: Request, res: Response) {
    try {
        const { rol } = req.query;
        const data = await service.getEncargadosDisponibles({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

export async function addEncargado(req: Request, res: Response) {
    try {
        const { id } = req.params; // ID de la zona
        const { encargadoId, rol } = req.body;
        const data = await service.assignEncargadoToZona(id, encargadoId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Encargado asignado con éxito", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}

export async function removeEncargado(req: Request, res: Response) {
    try {
        const { encargadoId } = req.params;
        const { rol } = req.body;

        const data = await service.removeEncargadoFromZona(encargadoId, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Encargado desvinculado", data));
    } catch (error: any) {
        return res.status(400).json(commonResponse(false, error.message, null));
    }
}