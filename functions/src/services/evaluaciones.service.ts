// Archivo: evaluaciones.service.ts

import { EvaluacionRepository } from "../repositories/evaluacion.repository"
import type { CreateEvaluacionData } from "../interfaces/evaluacion.interface"

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
}