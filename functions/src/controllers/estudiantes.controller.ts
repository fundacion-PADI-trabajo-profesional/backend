import type { Request, Response } from "express"
import { EstudiantesService } from "../services/estudiantes.service"
import { commonResponse } from "../interfaces/common-response.interface"


const service = new EstudiantesService()
export async function createEstudiante(req: Request, res: Response) {
    try {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id, usuario_id, rol } = req.body

        // Validación básica de campos obligatorios
        if (!dni || !nombre || !apellido || !fecha_nacimiento || !genero_id || !sala_id || !escuela_id) {
            return res
                .status(400)
                .json(commonResponse(false, "Faltan datos obligatorios", null, { code: "VALIDATION_ERROR" }))
        }

        if (rol === "docente" && (!usuario_id || !aula_id)) {
            return res
                .status(400)
                .json(commonResponse(false, "Para docentes, usuario_id y aula_id son obligatorios", null, { code: "VALIDATION_ERROR" }))
        }

        const data = await service.create({
            dni,
            nombre,
            apellido,
            fecha_nacimiento,
            genero_id,
            sala_id: Number(sala_id), // Aseguramos que sala_id sea número
            escuela_id,
            aula_id: typeof aula_id === "string" ? aula_id : undefined,
        }, (usuario_id && rol) ? { id: String(usuario_id), rol: String(rol) } : undefined)

        res.status(201).json(commonResponse(true, "Estudiante creado con éxito", data))

    } catch (error: any) {
        const message = error.message || "Error interno al crear estudiante"
        // Distinguir error de DNI duplicado
        const code = error.message.includes("DNI") ? "DNI_DUPLICADO" : "INTERNAL_ERROR"

        console.error("[createEstudiante] Error:", error)
        res.status(400).json(commonResponse(false, message, null, { code, description: message }))
    }
}

/**
 * Lista todos los estudiantes.
 * Responde a GET /estudiantes
 */
export async function listEstudiantes(req: Request, res: Response) {
    try {
        // Extraemos el rol y escuela_id que enviará el frontend en la query [cite: 5]
        const { escuela_id, rol } = req.query;

        let data;
        
        // Si es docente o director, filtramos obligatoriamente por su escuela asignada [cite: 1, 15]
        if ((rol === "docente" || rol === "director") && escuela_id) {
            // Debes crear este método 'listByEscuela' en tu servicio/repositorio [cite: 17, 18]
            data = await service.listByEscuela(String(escuela_id));
        } else if ((rol === "docente" || rol === "director") && !escuela_id) {
            // Si no se proporciona escuela_id, se puede manejar el caso como se desee
            return res.status(400).json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
        } else {
            // Usuarios admin (PADI/Encargados) siguen viendo todo el listado [cite: 1, 4]
            data = await service.list();
        }

        res.status(200).json(commonResponse(true, "ok", data));
    } catch (error: any) {
        const message = error.message || "Error interno al listar estudiantes"
        console.error("[listEstudiantes] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

/**
 * Obtiene la lista de géneros.
 * Responde a GET /generos
 */
export async function getGeneros(req: Request, res: Response) {
    try {
        const data = await service.getGeneros()
        res.status(200).json(commonResponse(true, "ok", data))
    } catch (error: any) {
        const message = error.message || "Error interno al obtener géneros"
        console.error("[getGeneros] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

/**
 * Obtiene la lista de salas.
 * Responde a GET /salas
 */
export async function getSalas(req: Request, res: Response) {
    try {
        const data = await service.getSalas()
        res.status(200).json(commonResponse(true, "ok", data))
    } catch (error: any) {
        const message = error.message || "Error interno al obtener salas"
        console.error("[getSalas] Error:", error)
        res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
    }
}

export async function asignarEstudianteAula(req: Request, res: Response) {
    try {
        const { estudianteId, aulaId } = req.body;
        const { usuario_id, rol } = req.query;

        if (!usuario_id || !rol) {
            return res.status(400).json(commonResponse(false, "Se requiere usuario_id y rol", null));
        }

        if (!estudianteId || !aulaId) {
            return res.status(400).json(commonResponse(false, "Se requiere estudianteId y aulaId", null));
        }

        const actor = { id: String(usuario_id), rol: String(rol) };
        const data = await service.asignarEstudianteAula(estudianteId, aulaId, actor);
        
        res.status(200).json(commonResponse(true, "Estudiante asignado al aula con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error al asignar estudiante al aula";
        console.error("[asignarEstudianteAula] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "ASSIGNMENT_ERROR", description: message }));
    }
}

export async function desasignarEstudianteAula(req: Request, res: Response) {
    try {
        const { estudianteId, aulaId } = req.body;
        const { usuario_id, rol } = req.query;

        if (!usuario_id || !rol) {
            return res.status(400).json(commonResponse(false, "Se requiere usuario_id y rol", null));
        }

        if (!estudianteId || !aulaId) {
            return res.status(400).json(commonResponse(false, "Se requiere estudianteId y aulaId", null));
        }

        const actor = { id: String(usuario_id), rol: String(rol) };
        const data = await service.desasignarEstudianteAula(estudianteId, aulaId, actor);
        
        res.status(200).json(commonResponse(true, "Estudiante desasignado del aula con éxito", data));
    } catch (error: any) {
        const message = error.message || "Error al desasignar estudiante del aula";
        console.error("[desasignarEstudianteAula] Error:", error);
        res.status(400).json(commonResponse(false, message, null, { code: "UNASSIGNMENT_ERROR", description: message }));
    }
}