import { EvaluacionRepository } from "../repositories/evaluacion.repository";
import type { CreateEvaluacionDTO } from "../interfaces/evaluacion.interface";
import { getPrisma } from "../config/prismaClient";

export class EvaluacionService {
  private repo = EvaluacionRepository;

  private async ensureProfesorRecord(userId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible");
    const prismaAny = prisma as any;

    const existing = await prismaAny.profesores.findUnique({ where: { id: userId } });
    if (existing) return;

    const user = await prismaAny.usuarioPerfil.findUnique({
      where: { id: userId },
      select: { id: true, nombre: true, apellido: true, rol: true },
    });
    if (!user) throw new Error("Usuario no encontrado.");
    if (user.rol !== "director" && user.rol !== "docente" && user.rol !== "encargado_zona") {
      throw new Error("Solo docentes, directores y encargados de zona pueden realizar evaluaciones.");
    }

    let persona = await prismaAny.personas.findFirst({ where: { usuario_id: userId } });
    if (!persona) {
      persona = await prismaAny.personas.create({
        data: {
          usuario_id: userId,
          nombre: user.nombre,
          primer_apellido: user.apellido,
        },
      });
    }

    await prismaAny.profesores.create({
      data: { id: userId, persona_id: persona.id },
    });
  }

  async createEvaluacion(data: CreateEvaluacionDTO) {
    await this.ensureProfesorRecord(data.profesor_id);

    const estudiante = await this.repo.findEstudianteByDni(data.dni);
    if (!estudiante) throw new Error("Estudiante no encontrado");

    let salaId = estudiante.sala_id;
    let aulaId: string | undefined = undefined;

    if (data.aula_id) {
      const asignacion = await this.repo.findActiveEstudianteAula(estudiante.id, data.aula_id);
      if (!asignacion?.aula) {
        throw new Error("El estudiante no está asignado activamente al aula indicada.");
      }
      aulaId = data.aula_id;
      salaId = asignacion.aula.sala_id;
    }

    return await this.repo.create({
      estudiante_id: estudiante.id,
      profesor_id: data.profesor_id,
      sala_id: salaId,
      aula_id: aulaId,
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

  async listWithFilters(filters?: {
    estudianteId?: string;
    profesorId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    escuelaId?: string;
  }) {
    return await this.repo.listWithFilters(filters);
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