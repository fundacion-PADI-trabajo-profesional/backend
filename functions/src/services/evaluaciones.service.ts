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
  // async getById(id: string) {
  //   const evaluacion = await this.repo.getById(id)
  //   if (!evaluacion) {
  //     throw new Error("Evaluación no encontrada.")
  //   }
  //   return evaluacion
  // }

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
      preguntas: data.questions.map(q => ({ id: q.id, answer: q.answer ?? 0 }))
    })
  }

  private async attachTotalPuntos(evaluacionData: any): Promise<any> {
    if (!evaluacionData || !evaluacionData.estudiantes || !evaluacionData.evaluaciones_estudiante_area) {
      return evaluacionData;
    }

    const salaId = evaluacionData.estudiantes.salas.grado;

    // 1. Obtener todas las reglas de aprobación para esta sala
    // NOTA: Asumimos que existe un método getReglasAprobacionBySala en el repositorio.
    const reglas = await this.repo.getReglasAprobacionBySala(salaId);

    // 2. Mapear las áreas de la evaluación con el puntaje total
    evaluacionData.evaluaciones_estudiante_area = evaluacionData.evaluaciones_estudiante_area.map((area: any) => {
      const regla = reglas.find((r: any) => r.area_id === area.area_id);

      // Adjuntamos el total de puntos posibles (el denominador)
      area.totalPuntosPosibles = regla?.puntaje_total || 6; // Usamos 6 como fallback seguro

      return area;
    });

    return evaluacionData;
  }


  // ----------------------------------------------------------------------
  // GET BY ID (Donde integramos la lógica)
  // ----------------------------------------------------------------------
  async getById(id: string) {
    const evaluacion = await this.repo.getById(id)
    if (!evaluacion) {
      throw new Error("Evaluación no encontrada.")
    }

    // Ejecutamos la lógica de adjuntar el puntaje total
    const evaluacionConTotales = await this.attachTotalPuntos(evaluacion);

    return evaluacionConTotales
  }
}