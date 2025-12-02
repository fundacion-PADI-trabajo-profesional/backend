import { getPrisma } from "../config/prismaClient";
import { CreateAulaDto } from "../interfaces/aula.interface";
import { AulasRepository, CreateAulaData, UpdateAulaData } from "../repositories/aula.repository";
import { ProfesoresAulasRepository } from "../repositories/profesor-aula.repository";

export class AulasService {
  private repo = AulasRepository;
  private profAulaRepo = ProfesoresAulasRepository;

  private async getDirectorWithEscuela(user: { id: string; rol: string }) {
    if (user.rol !== "director") {
      throw new Error("No tienes permisos para gestionar aulas.");
    }

    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible para gestionar aulas");

    const prismaAny = prisma as any;

    const director = await prismaAny.usuarioPerfil.findUnique({
      where: { id: user.id },
      select: { id: true, rol: true, escuela_id: true },
    });

    if (!director || director.rol !== "director") {
      throw new Error("Perfil de director no encontrado.");
    }

    if (!director.escuela_id) {
      throw new Error("El director no tiene una escuela asignada.");
    }

    return { prismaAny, director };
  }

  async create(data: CreateAulaDto, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    // 2) Verificar que la sala exista
    const sala = await prismaAny.salas.findUnique({
      where: { id: data.sala_id },
      select: { id: true },
    });

    if (!sala) {
      throw new Error("La sala seleccionada no existe.");
    }

    // 3) Crear el aula en la escuela del director
    const payload: CreateAulaData = {
      sala_id: data.sala_id,
      comision: data.comision,
      turno: data.turno,
      escuela_id: director.escuela_id,
    };

    return await this.repo.create(payload);
  }

  async list(user: { id: string; rol: string }) {
    const { director } = await this.getDirectorWithEscuela(user);
    return await this.repo.listByEscuela(director.escuela_id);
  }

  async update(id: string, data: UpdateAulaData, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    const aula = await prismaAny.aulas.findUnique({
      where: { id },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    if (aula.escuela_id !== director.escuela_id) {
      throw new Error("No tienes permisos para modificar esta aula.");
    }

    return await this.repo.update(id, data);
  }

  async delete(id: string, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    const aula = await prismaAny.aulas.findUnique({
      where: { id },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    if (aula.escuela_id !== director.escuela_id) {
      throw new Error("No tienes permisos para eliminar esta aula.");
    }

    // Verificar que no tenga asignaciones de estudiantes o profesores
    const [estCount, profCount] = await Promise.all([
      prismaAny.estudiantesAulas.count({ where: { aula_id: id } }),
      prismaAny.profesoresAulas.count({ where: { aula_id: id } }),
    ]);

    if (estCount > 0 || profCount > 0) {
      throw new Error("No se puede eliminar un aula con estudiantes o docentes asignados.");
    }

    await this.repo.delete(id);
  }

  async listDocentes(aulaId: string, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    if (aula.escuela_id !== director.escuela_id) {
      throw new Error("No tienes permisos para ver los docentes de esta aula.");
    }

    return this.profAulaRepo.listByAula(aulaId);
  }

  async asignarDocente(aulaId: string, profesorId: string, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    if (aula.escuela_id !== director.escuela_id) {
      throw new Error("No tienes permisos para gestionar docentes de esta aula.");
    }

    // Validar que el profesor exista
    const profesor = await prismaAny.profesores.findUnique({
      where: { id: profesorId },
      select: { id: true },
    });

    if (!profesor) {
      throw new Error("Docente no encontrado.");
    }

    return this.profAulaRepo.add(profesorId, aulaId);
  }

  async desasignarDocente(aulaId: string, profesorId: string, user: { id: string; rol: string }) {
    const { prismaAny, director } = await this.getDirectorWithEscuela(user);

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    if (aula.escuela_id !== director.escuela_id) {
      throw new Error("No tienes permisos para gestionar docentes de esta aula.");
    }

    await this.profAulaRepo.remove(profesorId, aulaId);
  }
}


