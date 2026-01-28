import { EvaluacionRepository } from "../repositories/evaluacion.repository";
import { CreateEvaluacionDTO } from "../interfaces/evaluacion.interface";

export class EvaluacionService {
  async createEvaluacion(data: CreateEvaluacionDTO) {
    const estudiante = await EvaluacionRepository.findEstudianteByDni(data.dni);
    if (!estudiante) throw new Error("Estudiante no encontrado");

    return await EvaluacionRepository.create({
      estudiante_id: estudiante.id,
      profesor_id: data.profesor_id,
      sala_id: estudiante.sala_id,
      tipo_id: data.tipo_id,
      fecha_creacion: new Date(data.fecha_creacion)
    });
  }

  async getListByDocente(profesorId: string) {
    return await EvaluacionRepository.findAllByProfesor(profesorId);
  }

  async getDetalle(id: string) {
    const evaluacion = await EvaluacionRepository.findById(id);
    if (!evaluacion) throw new Error("Evaluación no encontrada");
    return evaluacion;
  }

  async remove(id: string) {
    return await EvaluacionRepository.delete(id);
  }
}