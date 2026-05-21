import type { Request, Response } from "express"
import { EstudiantesService } from "../services/estudiantes.service"
import { commonResponse } from "../interfaces/common-response.interface"
import { AuthenticatedRequest } from "../middlewares/auth.middleware"
import { getDocenteEscuelas } from "../utils/scope"


const service = new EstudiantesService()

/**
 * Crea un nuevo estudiante en el sistema.
 *
 * @remarks
 * La validación de campos obligatorios difiere según el rol del solicitante:
 * - **Docente**: requiere `aula_id` (la escuela se infiere del aula).
 * - **Otros roles**: requieren `sala_id` y `escuela_id` explícitos.
 *
 * `POST /estudiantes`
 *
 * @param req - Request autenticado. Body: `{ dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id?, escuela_id?, aula_id? }`.
 * @param res - `201` con el estudiante creado, `400` si faltan datos o el DNI ya existe.
 */
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

/**
 * Lista los estudiantes según el rol del usuario autenticado.
 *
 * @remarks
 * - **Director**: ve solo los estudiantes de su escuela (forzado desde el token, no del query param).
 * - **Docente**: requiere `escuela_id` como query param.
 * - **Admin / Encargado de zona**: ve todos los estudiantes.
 *
 * `GET /estudiantes`
 *
 * @param req - Request autenticado. Query: `escuela_id?` (requerido para docentes).
 * @param res - `200` con el array de estudiantes, `400` si faltan datos de ubicación, `500` error interno.
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
        } else if (user.rol === "docente") {
            if (!escuela_id) {
                return res.status(400).json(commonResponse(false, "Se requiere escuela_id para listar estudiantes.", null, { code: "VALIDATION_ERROR" }));
            }
            const docenteEscuelas = await getDocenteEscuelas(user.id);
            if (!docenteEscuelas.includes(String(escuela_id))) {
                return res.status(403).json(commonResponse(false, "No tiene permisos para ver estudiantes de esa escuela.", null));
            }
            data = await service.listByEscuela(String(escuela_id), user);
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

/**
 * Retorna el catálogo de géneros disponibles para la carga de estudiantes.
 *
 * `GET /generos`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de géneros, `500` si ocurre un error interno.
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

/**
 * Retorna el catálogo de salas disponibles (sala 3, 4, 5, etc.).
 *
 * `GET /salas`
 *
 * @param req - Request autenticado.
 * @param res - `200` con el array de salas, `500` si ocurre un error interno.
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

/**
 * Asigna un estudiante a un aula.
 *
 * `POST /estudiantes/asignar-aula`
 *
 * @param req - Request autenticado. Body: `{ estudianteId, aulaId }`.
 * @param res - `200` con la relación creada, `400` si faltan datos.
 */
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

/**
 * Desasigna un estudiante de un aula.
 *
 * `POST /estudiantes/desasignar-aula`
 *
 * @param req - Request autenticado. Body: `{ estudianteId, aulaId }`.
 * @param res - `200` si fue desasignado, `400` si faltan datos.
 */
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

/**
 * Actualiza los datos de un estudiante existente.
 *
 * `PUT /estudiantes/:id`
 *
 * @param req - Request autenticado. Param: `id`. Body: `{ dni?, nombre?, apellido?, fecha_nacimiento?, genero_id?, sala_id?, escuela_id?, aula_id? }`.
 * @param res - `200` con el estudiante actualizado, `403` sin permisos, `400` si falta el ID.
 */
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

/**
 * Crea estudiantes en masa a partir de un array, con soporte de modo de prueba (dry run).
 *
 * @remarks
 * Si `dryRun` es `true`, el sistema valida el array y retorna un análisis de errores
 * potenciales sin persistir ningún dato. Útil para previsualizar el resultado de una
 * importación masiva antes de confirmarla.
 *
 * `POST /estudiantes/bulk`
 *
 * @param req - Request autenticado. Body: `{ estudiantes, escuela_id, aula_id, dryRun? }`.
 * @param res - `201` si se crearon, `200` si es dry run, `400` si el array está vacío o es inválido.
 */
export async function deleteEstudiante(req: AuthenticatedRequest, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json(commonResponse(false, "Falta el ID del estudiante", null, { code: "VALIDATION_ERROR" }));
        }
        const user = { id: req.user!.id, rol: req.user!.rol };
        await service.delete(id, user);
        return res.status(200).json(commonResponse(true, "Estudiante eliminado con éxito", null));
    } catch (error: any) {
        const message = error.message || "Error al eliminar estudiante";
        console.error("[deleteEstudiante] Error:", error);
        const statusCode = message.includes("permisos") ? 403 : 400;
        return res.status(statusCode).json(commonResponse(false, message, null, { code: "DELETE_ERROR", description: message }));
    }
}

export async function bulkCreateEstudiantes(req: AuthenticatedRequest, res: Response) {
    try {
        const { estudiantes, escuela_id, aula_id, dryRun} = req.body;
        const user = {
            id: req.user!.id,
            rol: req.user!.rol,
        };

        if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
            return res.status(400).json(commonResponse(false, "Se requiere un array de estudiantes", null));
        }

        const data = await service.createBulk(estudiantes, { escuela_id, aula_id }, user, dryRun);
        res.status(dryRun ? 200 : 201).json(commonResponse(true, dryRun ? "Análisis completado" : "Estudiantes procesados con éxito", data));
    
    } catch (error: any) {
        const message = error.message || "Error interno al crear estudiantes en masa";
        console.error("[bulkCreateEstudiantes] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "BULK_ERROR", description: message }));
    }
}