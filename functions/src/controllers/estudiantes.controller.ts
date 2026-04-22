import type { Request, Response } from "express"
import { EstudiantesService } from "../services/estudiantes.service"
import { commonResponse } from "../interfaces/common-response.interface"
import { AuthenticatedRequest } from "../middlewares/auth.middleware"


const service = new EstudiantesService()
export async function createEstudiante(req: AuthenticatedRequest, res: Response) {
    try {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id } = req.body;
        const user = { id: req.user!.id, rol: req.user!.rol };

        if (!dni || !nombre || !apellido || !fecha_nacimiento || !genero_id) {
            return res.status(400).json(commonResponse(false, "Faltan datos personales obligatorios", null, { code: "VALIDATION_ERROR" }));
        }

        // Lógica para Docentes: Solo necesitan aula_id
        if (user.rol === "docente") {
            if (!aula_id) {
                return res.status(400).json(commonResponse(false, "El aula_id es obligatorio para docentes", null, { code: "VALIDATION_ERROR" }));
            }
        }
        // Lógica para otros roles: Necesitan escuela y sala manualmente
        else {
            if (!sala_id || !escuela_id) {
                return res.status(400).json(commonResponse(false, "Faltan datos de ubicación (escuela/sala)", null, { code: "VALIDATION_ERROR" }));
            }
        }

        const data = await service.create({
            dni,
            nombre,
            apellido,
            fecha_nacimiento,
            genero_id,
            sala_id: sala_id ? Number(sala_id) : 0,
            escuela_id,
            aula_id: typeof aula_id === "string" ? aula_id : undefined,
        }, user);

        res.status(201).json(commonResponse(true, "Estudiante creado con éxito", data));

    } catch (error: any) {
        const message = error.message || "Error interno al crear estudiante"
        // Distinguir error de DNI duplicado
        const code = error.message.includes("DNI") ? "DNI_DUPLICADO" : "INTERNAL_ERROR"
        res.status(400).json(commonResponse(false, message, null, { code, description: message }))
    }
}

/*
 * Lista todos los estudiantes.
 * Responde a GET /estudiantes
*/
export async function listEstudiantes(req: AuthenticatedRequest, res: Response) {
    try {
        // Extraemos el rol y escuela_id que enviará el frontend en la query
        const { escuela_id } = req.query;

        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        }
        let data;

        // Para directores: siempre se fuerza la escuela del token — nunca del query param
        if (user.rol === "director") {
            const escuelaIdFromToken = req.user!.escuela_id;
            if (!escuelaIdFromToken) {
                return res.status(400).json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
            }
            data = await service.listByEscuela(escuelaIdFromToken, user);
        } else if (user.rol === "docente" && escuela_id) {
            data = await service.listByEscuela(String(escuela_id), user);
        } else if (user.rol === "docente" && !escuela_id) {
            return res.status(400).json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
        } else {
            // Usuarios admin (PADI/Encargados) siguen viendo todo el listado
            data = await service.list(user);
        }

        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error.message || "Error interno al listar estudiantes"
        console.error("[listEstudiantes] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

/*
 * Obtiene la lista de géneros.
 * Responde a GET /generos
*/
export async function getGeneros(req: AuthenticatedRequest, res: Response) {
    try {
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        }
        const data = await service.getGeneros(user)
        res.status(200).json(commonResponse(true, "ok", data))
    } catch (error: any) {
        const message = error.message || "Error interno al obtener géneros"
        console.error("[getGeneros] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

/*
 * Obtiene la lista de salas.
 * Responde a GET /salas
*/
export async function getSalas(req: AuthenticatedRequest, res: Response) {
    try {
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        }
        const data = await service.getSalas(user)
        res.status(200).json(commonResponse(true, "ok", data))
    } catch (error: any) {
        const message = error.message || "Error interno al obtener salas"
        console.error("[getSalas] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

export async function asignarEstudianteAula(req: AuthenticatedRequest, res: Response) {
    try {
        const { estudianteId, aulaId } = req.body;

        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        }

        if (!user.id || !user.rol) {
            return res.status(400).json(commonResponse(false, "Se requiere usuario_id y rol", null));
        }

        if (!estudianteId || !aulaId) {
            return res.status(400).json(commonResponse(false, "Se requiere estudianteId y aulaId", null));
        }

        const actor = { id: String(user.id), rol: String(user.rol) };
        const data = await service.asignarEstudianteAula(estudianteId, aulaId, actor);

        res.status(200).json(commonResponse(true, "Estudiante asignado al aula con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error al asignar estudiante al aula";
        console.error("[asignarEstudianteAula] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "ASSIGNMENT_ERROR", description: message }));
    }
}

export async function desasignarEstudianteAula(req: AuthenticatedRequest, res: Response) {
    try {
        const { estudianteId, aulaId } = req.body;
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        }

        if (!user.id || !user.rol) {
            return res.status(400).json(commonResponse(false, "Se requiere usuario_id y rol", null));
        }

        if (!estudianteId || !aulaId) {
            return res.status(400).json(commonResponse(false, "Se requiere estudianteId y aulaId", null));
        }

        const data = await service.desasignarEstudianteAula(estudianteId, aulaId, user);

        res.status(200).json(commonResponse(true, "Estudiante desasignado del aula con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error al desasignar estudiante del aula";
        console.error("[desasignarEstudianteAula] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "UNASSIGNMENT_ERROR", description: message }));
    }
}

export async function updateEstudiante(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id } = req.body;
        const user = { id: req.user!.id, rol: req.user!.rol, escuela_id: req.user!.escuela_id };

        if (!id) {
            return res.status(400).json(commonResponse(false, "Falta el ID del estudiante", null, { code: "VALIDATION_ERROR" }));
        }

        const data = await service.update(id, {
            dni,
            nombre,
            apellido,
            fecha_nacimiento,
            genero_id,
            sala_id: sala_id ? Number(sala_id) : undefined,
            escuela_id,
            aula_id,
        }, user);

        res.status(200).json(commonResponse(true, "Estudiante actualizado con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error interno al actualizar estudiante";
        console.error("[updateEstudiante] Error:", error);
        const statusCode = message.includes("permisos") ? 403 : 400;
        res.status(statusCode).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }));
    }
}

export async function bulkCreateEstudiantes(req: AuthenticatedRequest, res: Response) {
    try {
        const { estudiantes, escuela_id, aula_id } = req.body;
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        };


        if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
            return res.status(400).json(commonResponse(false, "Se requiere un array de estudiantes", null));
        }

        const data = await service.createBulk(estudiantes, { escuela_id, aula_id }, user);
        res.status(201).json(commonResponse(true, "Estudiantes creados con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error interno al crear estudiantes en masa";
        console.error("[bulkCreateEstudiantes] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "BULK_ERROR", description: message }));
    }
}