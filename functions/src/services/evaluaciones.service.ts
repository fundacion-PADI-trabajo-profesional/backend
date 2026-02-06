import { EvaluacionRepository } from "../repositories/evaluacion.repository";
import type { CreateEvaluacionDTO } from "../interfaces/evaluacion.interface";

export class EvaluacionService {
  private repo = EvaluacionRepository;

  async createEvaluacion(data: CreateEvaluacionDTO) {
    const estudiante = await this.repo.findEstudianteByDni(data.dni);
    if (!estudiante) throw new Error("Estudiante no encontrado");

    return await this.repo.create({
      estudiante_id: estudiante.id,
      profesor_id: data.profesor_id,
      sala_id: estudiante.sala_id,
      tipo_id: data.tipo_id,
      fecha_creacion: new Date(data.fecha_creacion)
    });
  }

  async getListByDocente(profesorId: string) {
    return await this.repo.findAllByProfesor(profesorId);
  }

  async list() {
    return await this.repo.list();
  }

  async listByEscuela(escuelaId: string) {
    return await this.repo.listByEscuela(escuelaId);
  }

  async getDetalle(id: string) {
    const evaluacion = await this.repo.findById(id);
    if (!evaluacion) throw new Error("Evaluación no encontrada");
    return evaluacion;
  }

  async remove(id: string) {
    return await this.repo.delete(id);
  }

  async getPreguntasArea(evaluacionId: string, areaId: string) {
    return await this.repo.getPreguntasArea(evaluacionId, areaId);
  }

  async guardarRespuestas(evaluacionId: string, areaId: string, questions: { id: string; answer: number | null }[]) {
    return await this.repo.saveRespuestas(evaluacionId, areaId, questions);
  }
}