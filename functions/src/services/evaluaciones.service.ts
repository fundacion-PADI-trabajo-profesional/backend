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
   * Lista evaluaciones con detalles, opcionalmente filtradas.
   */
  async list(filters?: {
    estudianteId?: string
    profesorId?: string
    salaId?: number
    tipoId?: string
    estadoId?: string
  }) {
    const rows = await this.repo.list()

    if (!filters) return rows

    return rows.filter((row: any) => {
      if (filters.estudianteId && row.estudiante_id !== filters.estudianteId) return false
      if (filters.profesorId && row.profesor_id !== filters.profesorId) return false
      if (typeof filters.salaId === "number" && row.sala_id !== filters.salaId) return false
      if (filters.tipoId && row.tipo_id !== filters.tipoId) return false
      if (filters.estadoId && row.estado_id !== filters.estadoId) return false
      return true
    })
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
}