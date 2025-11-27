// Archivo: evaluaciones.controller.ts

import type { Request, Response } from "express"
import { EvaluacionesService } from "../services/evaluaciones.service"
import { commonResponse } from "../interfaces/common-response.interface"

const service = new EvaluacionesService()

// ----------------------------------------------------------------------
// POST /evaluaciones: Crea una evaluación
// ----------------------------------------------------------------------
export async function createEvaluacion(req: Request, res: Response) {
  try {
    const { dni, tipo_id, profesor_id, fecha_creacion } = req.body

    if (!dni || !tipo_id || !profesor_id || !fecha_creacion) { // <--- Validación actualizada
      return res
        .status(400)
        .json(commonResponse(false, "Faltan datos obligatorios", null, { code: "VALIDATION_ERROR" }))
    }

    const data = await service.create({
      dni,
      tipo_id,
      profesor_id,
      fecha_creacion, // <--- Pasamos la fecha
    })

    res.status(201).json(commonResponse(true, "Evaluación creada con éxito", data))
  } catch (error: any) {
    const message = error.message || "Error interno al crear la evaluación"
    let code = "INTERNAL_ERROR"

    if (message.includes("Estudiante")) {
      code = "ESTUDIANTE_NO_ENCONTRADO"
      return res.status(404).json(commonResponse(false, message, null, { code, description: message }))
    } else if (message.includes("profesor")) {
      code = "PERMISO_DENEGADO"
      // Error de autorización/permiso
      return res.status(403).json(commonResponse(false, message, null, { code, description: message }))
    }

    console.error("[createEvaluacion] Error:", error)
    res.status(400).json(commonResponse(false, message, null, { code, description: message }))
  }
}

// ----------------------------------------------------------------------
// GET /evaluaciones: Lista todas las evaluaciones
// ----------------------------------------------------------------------
export async function listEvaluaciones(req: Request, res: Response) {
  try {
    const data = await service.list()
    res.status(200).json(commonResponse(true, "ok", data))
  } catch (error: any) {
    const message = error.message || "Error interno al listar evaluaciones"
    console.error("[listEvaluaciones] Error:", error)
    res.status(500).json(commonResponse(false, message, null, { code: "INTERNAL_ERROR", description: message }))
  }
}

// ----------------------------------------------------------------------
// GET /evaluaciones/:id: Obtiene el detalle de una evaluación
// ----------------------------------------------------------------------
export async function getEvaluacionById(req: Request, res: Response) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json(commonResponse(false, "Falta el ID de la evaluación", null, { code: "VALIDATION_ERROR" }))
    }

    const data = await service.getById(id)
    res.status(200).json(commonResponse(true, "ok", data))
  } catch (error: any) {
    const message = error.message || "Error interno al obtener la evaluación"
    let code = "INTERNAL_ERROR"

    if (message.includes("Evaluación no encontrada")) {
      code = "EVALUACION_NO_ENCONTRADA"
      // Not Found
      return res.status(404).json(commonResponse(false, message, null, { code, description: message }))
    }

    console.error("[getEvaluacionById] Error:", error)
    res.status(500).json(commonResponse(false, message, null, { code, description: message }))
  }
}

// ----------------------------------------------------------------------
// DELETE /evaluaciones/:id: Elimina una evaluación
// ----------------------------------------------------------------------
export async function deleteEvaluacion(req: Request, res: Response) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json(commonResponse(false, "Falta el ID", null, { code: "VALIDATION_ERROR" }))
    }

    await service.delete(id)

    res.status(200).json(commonResponse(true, "Evaluación eliminada con éxito", null))

  } catch (error: any) {
    const message = error.message || "Error interno al eliminar la evaluación"
    let code = "INTERNAL_ERROR"

    if (message.includes("no existe")) {
      code = "NOT_FOUND"
      return res.status(404).json(commonResponse(false, message, null, { code, description: message }))
    }

    console.error("[deleteEvaluacion] Error:", error)
    res.status(500).json(commonResponse(false, message, null, { code, description: message }))
  }
}

// ----------------------------------------------------------------------
// GET /evaluaciones/:id/areas/:areaId/preguntas
// ----------------------------------------------------------------------
export async function getPreguntasEvaluacion(req: Request, res: Response) {
  try {
    const { id, areaId } = req.params

    if (!id || !areaId) {
      return res.status(400).json(commonResponse(false, "Faltan datos de evaluación o área", null, { code: "VALIDATION_ERROR" }))
    }

    const data = await service.getPreguntas(id, areaId)
    res.status(200).json(commonResponse(true, "ok", data))
  } catch (error: any) {
    console.error("Error getPreguntas:", error)
    res.status(500).json(commonResponse(false, error.message, null))
  }
}

// ----------------------------------------------------------------------
// POST /evaluaciones/:id/respuestas
// ----------------------------------------------------------------------
export async function submitRespuestas(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { areaId, questions } = req.body

    if (!id || !areaId || !questions || !Array.isArray(questions)) {
      return res.status(400).json(commonResponse(false, "Faltan datos (evaluacionId, areaId, questions)", null))
    }

    const result = await service.submitRespuestas({
      evaluacionId: id,
      areaId,
      questions // Array de { id: string, answer: number | null }
    })
    res.status(200).json(commonResponse(true, "Respuestas guardadas", result))
  } catch (error: any) {
    console.error("Error submitRespuestas:", error)
    res.status(500).json(commonResponse(false, error.message, null))
  }
}