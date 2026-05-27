import { Request, Response } from "express";
import { EscuelasService } from "../services/escuelas.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AulasService } from "../services/aulas.service";

const service = new EscuelasService();
const aulasService = new AulasService();

/**
 * Lista las escuelas accesibles para el usuario autenticado.
 *
 * @remarks
 * El servicio aplica filtros según el rol: un director solo ve su escuela,
 * un encargado de zona solo las de su zona, un admin ve todas.
 *
 * `GET /escuelas`
 *
 * @param req - Request autenticado. Sin parámetros adicionales.
 * @param res - `200` con el array de escuelas, `500` si ocurre un error interno.
 */
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

/**
 * Actualiza los datos de una escuela existente.
 *
 * `PUT /escuelas/:id`
 *
 * @param req - Request autenticado. Param: `id`. Body: `{ nombre, zona_id, direccion?, telefono? }`.
 * @param res - `200` con la escuela actualizada, `400` si faltan `nombre` o `zona_id`.
 */
export async function updateEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { nombre, direccion, telefono, zona_id, nivel_socioeconomico } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(commonResponse(false, "Nombre y Zona son obligatorios", null));
        }

        const user = {
            id: req.user!.id,
            rol: req.user!.rol
        };
        const result = await service.update(id, { nombre, direccion, telefono, zona_id, nivel_socioeconomico }, user);

        res.status(200).json(commonResponse(true, "Institución actualizada", result));
    } catch (error: any) {
        const isAuthz = error?.message?.includes("permisos");
        res.status(isAuthz ? 403 : 400).json(commonResponse(false, error.message, null));
    }
}

/**
 * Crea una nueva escuela y genera automáticamente aulas por defecto (salas 3, 4 y 5).
 *
 * @remarks
 * Al crear la escuela, el sistema intenta crear aulas para las salas 3, 4 y 5 con
 * comisión "Única" y turno "Mañana". Si la creación de alguna aula falla, se registra
 * un aviso pero la escuela queda creada igualmente.
 *
 * `POST /escuelas`
 *
 * @param req - Request autenticado. Body: `{ nombre, zona_id, direccion?, telefono? }`.
 * @param res - `201` con la escuela creada, `400` si faltan `nombre` o `zona_id`.
 */
export async function createEscuela(req: AuthenticatedRequest, res: Response) {
    try {
        const { nombre, direccion, telefono, zona_id, nivel_socioeconomico } = req.body;

        if (!nombre || !zona_id) {
            return res.status(400).json(
                commonResponse(false, "Faltan datos obligatorios (nombre o zona)", null, { code: "VALIDATION_ERROR" })
            );
        }

        const user = { id: req.user!.id, rol: req.user!.rol };
        const data = await service.create({ nombre, direccion, telefono, zona_id, nivel_socioeconomico }, user);

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

/**
 * Asigna un directivo a una escuela.
 *
 * `POST /escuelas/asignar-directivo`
 *
 * @param req - Request autenticado. Body: `{ escuelaId, usuarioId }`.
 * @param res - `200` si fue asignado, `500` si la operación falla.
 */
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

/**
 * Desvincula el directivo actual de una escuela.
 *
 * `POST /escuelas/desasignar-directivo`
 *
 * @param req - Request autenticado. Body: `{ usuarioId }`.
 * @param res - `200` si fue desvinculado, `500` si la operación falla.
 */
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

/**
 * Elimina una escuela y libera todos sus vínculos (aulas, docentes, directivos).
 *
 * `DELETE /escuelas/:id`
 *
 * @param req - Request autenticado. Param: `id` de la escuela.
 * @param res - `200` si fue eliminada, `400` si la eliminación falla.
 */
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