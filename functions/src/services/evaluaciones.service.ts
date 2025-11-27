// Archivo: evaluaciones.service.ts

import { EvaluacionRepository } from "../repositories/evaluacion.repository"
import type { CreateEvaluacionData } from "../interfaces/evaluacion.interface"
import type { SubmitAnswersPayload } from "../interfaces/evaluacion.interface"

export class EvaluacionesService {
  private repo = EvaluacionRepository

  /**
   * Crea la evaluación y sus áreas asociadas, incluyendo la verificación de permisos del profesor.
   */
  async create(data: CreateEvaluacionData) {
    // 1. Verificar Permisos: Asegura que el profesor que intenta crear la evaluación existe.
    const hasPermission = await this.repo.checkProfessorExists(data.profesor_id)

    if (!hasPermission) {
      throw new Error("El profesor no existe o no tiene permisos para crear evaluaciones.")
    }

    // 2. Creación de la Evaluación
    return await this.repo.create(data)
  }

  /**
   * Lista todas las evaluaciones con detalles.
   */
  async list() {
    return await this.repo.list()
  }

  /**
   * Obtiene el detalle de una evaluación por su ID.
   */
  async getById(id: string) {
    const evaluacion = await this.repo.getById(id)
    if (!evaluacion) {
      throw new Error("Evaluación no encontrada.")
    }
    return evaluacion
  }

  async delete(id: string) {
    return await this.repo.delete(id)
  }

  async getPreguntas(evaluacionId: string, areaId: string) {
    return await this.repo.getPreguntasByEvaluacionAndArea(evaluacionId, areaId)
  }

  async submitRespuestas(data: { evaluacionId: string, areaId: string, questions: { id: string, answer: number | null }[] }) {
    // Mapeamos y aseguramos que 'answer' sea numérico para el repositorio (0 o 1)
    return await this.repo.saveRespuestas({
      evaluacionId: data.evaluacionId,
      areaId: data.areaId,
      preguntas: data.questions.map(q => ({ id: q.id, answer: q.answer === null ? null : (q.answer || 0) }))
    })
  }
}