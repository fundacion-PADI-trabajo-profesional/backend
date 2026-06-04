import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ZonasService } from "../services/zonas.service";
import { commonResponse } from "../interfaces/common-response.interface";

const service = new ZonasService();

/**
 * Crea una nueva zona geográfica en el sistema.
 *
 * `POST /zonas`
 *
 * @param req - Request autenticado con rol `admin`. Body: `{ nombre }`.
 * @param res - `201` con la zona creada, `403` si el rol no tiene permisos.
 */
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

/**
 * Lista todas las zonas geográficas registradas.
 *
 * `GET /zonas`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de zonas, `403` si el rol no tiene permisos.
 */
export async function listZonas(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.list({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

/**
 * Retorna el detalle de una zona, incluyendo sus escuelas y encargados asignados.
 *
 * `GET /zonas/:id`
 *
 * @param req - Request autenticado. Param: `id` de la zona.
 * @param res - `200` con el detalle, `404` si la zona no existe.
 */
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

/**
 * Asigna una escuela a una zona geográfica.
 *
 * `POST /zonas/:id/escuelas`
 *
 * @param req - Request autenticado. Param: `id` de la zona. Body: `{ escuelaId }`.
 * @param res - `200` con la zona actualizada, `400` si la asignación falla.
 */
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

/**
 * Lista las escuelas que aún no pertenecen a ninguna zona.
 *
 * @remarks
 * Usado por el frontend para poblar el selector al asignar una escuela a una zona.
 *
 * `GET /zonas/escuelas-disponibles`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de escuelas disponibles, `403` sin permisos.
 */
export async function listEscuelasDisponibles(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEscuelasDisponibles({ rol: String(rol) });

        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

/**
 * Desvincula una escuela de su zona actual.
 *
 * `DELETE /zonas/escuelas/:escuelaId`
 *
 * @param req - Request autenticado. Param: `escuelaId`.
 * @param res - `200` si fue desvinculada, `400` si la operación falla.
 */
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

/**
 * Actualiza el nombre de una zona geográfica.
 *
 * `PUT /zonas/:id`
 *
 * @param req - Request autenticado. Param: `id`. Body: `{ nombre }`.
 * @param res - `200` con la zona actualizada, `400` si la operación falla.
 */
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


/**
 * Lista los encargados de zona que aún no tienen zona asignada.
 *
 * @remarks
 * Usado por el frontend para poblar el selector al asignar un encargado a una zona.
 *
 * `GET /zonas/encargados-disponibles`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de encargados disponibles, `403` sin permisos.
 */
export async function listEncargadosSinZona(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEncargadosDisponibles({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

/**
 * Lista todos los encargados de zona asignados a alguna zona.
 *
 * `GET /zonas/encargados`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de encargados, `403` sin permisos.
 */
export async function listEncargados(req: AuthenticatedRequest, res: Response) {
    try {
        const rol = req.user!.rol
        const data = await service.getEncargados({ rol: String(rol) });
        return res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        return res.status(403).json(commonResponse(false, error.message, null));
    }
}

/**
 * Asigna un encargado de zona a una zona geográfica.
 *
 * `POST /zonas/:id/encargados`
 *
 * @param req - Request autenticado. Param: `id` de la zona. Body: `{ encargadoId }`.
 * @param res - `200` con la zona actualizada, `400` si la asignación falla.
 */
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

/**
 * Desvincula un encargado de zona de su zona actual.
 *
 * `DELETE /zonas/encargados/:encargadoId`
 *
 * @param req - Request autenticado. Param: `encargadoId`.
 * @param res - `200` si fue desvinculado, `400` si la operación falla.
 */
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

/**
 * Elimina una zona geográfica del sistema.
 *
 * `DELETE /zonas/:id`
 *
 * @remarks
 * Desvincula automáticamente los encargados y escuelas asociados antes de eliminar.
 *
 * @param req - Request autenticado. Param: `id` de la zona.
 * @param res - `200` si fue eliminada, `404` si no existe, `403` sin permisos.
 */
export async function deleteZona(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const rol = req.user!.rol;

        const data = await service.delete(id, { rol: String(rol) });
        return res.status(200).json(commonResponse(true, "Zona eliminada", data));
    } catch (error: any) {
        const status = error.message === "La zona no existe." ? 404 : 403;
        return res.status(status).json(commonResponse(false, error.message, null));
    }
}