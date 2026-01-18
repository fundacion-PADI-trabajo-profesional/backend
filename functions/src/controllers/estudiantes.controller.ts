import type { Request, Response } from "express"
import { EstudiantesService } from "../services/estudiantes.service"
import { commonResponse } from "../interfaces/common-response.interface"

const service = new EstudiantesService()
export async function createEstudiante(req: Request, res: Response) {
    try {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id } = req.body

        // Validación básica de campos obligatorios
        if (!dni || !nombre || !apellido || !fecha_nacimiento || !genero_id || !sala_id || !escuela_id) {
            return res
                .status(400)
                .json(commonResponse(false, "Faltan datos obligatorios", null, { code: "VALIDATION_ERROR" }))
        }

        const data = await service.create({
            dni,
            nombre,
            apellido,
            fecha_nacimiento,
            genero_id,
            sala_id: Number(sala_id), // Aseguramos que sala_id sea número
            escuela_id
        })

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
        const data = await service.list()
        res.status(200).json(commonResponse(true, "ok", data))
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