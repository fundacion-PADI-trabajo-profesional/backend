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

    // Aseguramos que el salaId sea el tipo correcto (int/number) si es necesario para el query de reglas
    const salaIdForQuery = Number(evaluacionData.estudiantes.salas.grado);

    // 1. Obtener todas las reglas de aprobación para esta sala
    const reglas = await this.repo.getReglasAprobacionBySala(salaIdForQuery);

    if (reglas.length === 0) {
      console.warn(`[AttachPuntos] No se encontraron reglas de aprobación para Sala ID: ${salaIdForQuery}. Usando fallback 6.`);
    }

    // A. Preparar promesas para obtener el total de preguntas activas por área
    const areaPromises = evaluacionData.evaluaciones_estudiante_area.map((area: any) => {
      // USAMOS EL ID DE LA INSTANCIA DE ÁREA (item.id)
      return this.repo.getAreaScoreDetails(area.id, salaIdForQuery, area.area_id);
    });

    // B. Ejecutar todas las promesas de cálculo
    const areaScoreDetailsArray = await Promise.all(areaPromises);

    // 2. Mapear las áreas con los datos calculados
    evaluacionData.evaluaciones_estudiante_area = evaluacionData.evaluaciones_estudiante_area.map((area: any, index: number) => {
      const regla = reglas.find((r: any) => r.area_id === area.area_id);
      const scoreDetails = areaScoreDetailsArray[index]; // Detalle calculado

      // Adjuntamos los campos calculados:
      area.totalPuntosPosibles = regla?.puntaje_total || 6;
      area.totalPreguntas = scoreDetails.totalPreguntasActivas; // Denominador
      area.aciertos_individuales = scoreDetails.aciertosIndividuales; // <--- NUMERADOR CLAVE (En snake_case para el mapper)

      // Opcional: Aseguramos que el estado y puntaje de grupo estén actualizados
      area.estado_id = scoreDetails.estadoFinalArea;
      area.puntaje = scoreDetails.puntajeFinal;

      return area;
    });

    return evaluacionData;
  }


  // ----------------------------------------------------------------------
  // GET BY ID (Versión FINAL con lógica de adjuntar totales)
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