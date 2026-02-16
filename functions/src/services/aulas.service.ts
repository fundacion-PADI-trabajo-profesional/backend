import { getPrisma } from "../config/prismaClient";
import { CreateAulaDto } from "../interfaces/aula.interface";
import { AulasRepository, CreateAulaData, UpdateAulaData } from "../repositories/aula.repository";
import { ProfesoresAulasRepository } from "../repositories/profesor-aula.repository";

export class AulasService {
  private repo = AulasRepository;
  private profAulaRepo = ProfesoresAulasRepository;

  private async getUserWithPermissions(user: { id: string; rol: string }) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible para gestionar aulas");
    const prismaAny = prisma as any;

    // EQUIPO PADI: Acceso total a todas las escuelas
    if (user.rol === "equipo_padi") {
      return {
        prismaAny,
        userType: "padi" as const,
        allowedEscuelas: "all" as const,
        userId: user.id
      };
    }

    // ENCARGADO DE ZONA: Acceso a escuelas de su zona
    if (user.rol === "encargado_zona") {
      const encargado = await prismaAny.encargados.findUnique({
        where: { usuario_id: user.id },
        select: {
          id: true,
          zona: {
            select: {
              id: true,
              nombre: true,
              escuelas: { select: { id: true } }
            }
          }
        },
      });

      if (!encargado || !encargado.zona) {
        throw new Error("Perfil de encargado de zona no encontrado o sin zona asignada.");
      }

      const escuelaIds = encargado.zona.escuelas.map((e: any) => e.id);
      return {
        prismaAny,
        userType: "encargado" as const,
        allowedEscuelas: escuelaIds,
        userId: user.id,
        zonaId: encargado.zona.id
      };
    }

    // DIRECTOR: Acceso solo a su escuela asignada
    if (user.rol === "director") {
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

      return {
        prismaAny,
        userType: "director" as const,
        allowedEscuelas: [director.escuela_id],
        userId: user.id,
        escuelaId: director.escuela_id
      };
    }

    throw new Error("No tienes permisos para gestionar aulas.");
  }

  async create(data: CreateAulaDto, user: { id: string; rol: string }) {
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    // Verificar que la sala exista
    const sala = await prismaAny.salas.findUnique({
      where: { id: data.sala_id },
      select: { id: true },
    });

    if (!sala) {
      throw new Error("La sala seleccionada no existe.");
    }

    let escuela_id: string;

    // Determinar la escuela según el tipo de usuario
    if (userPerms.userType === "director") {
      escuela_id = userPerms.escuelaId!;
    } else {
      // Para PADI y encargados, necesitamos que especifiquen la escuela
      if (!data.escuela_id) {
        throw new Error("Debe especificar la escuela para crear el aula.");
      }

      // Verificar permisos sobre la escuela
      if (userPerms.userType === "encargado") {
        if (!userPerms.allowedEscuelas.includes(data.escuela_id)) {
          throw new Error("No tienes permisos para crear aulas en esta escuela.");
        }
      }
      // PADI puede crear en cualquier escuela

      escuela_id = data.escuela_id;
    }

    const payload: CreateAulaData = {
      sala_id: data.sala_id,
      comision: data.comision,
      turno: data.turno,
      escuela_id: escuela_id,
    };

    return await this.repo.create(payload);
  }

  async list(user: { id: string; rol: string }) {
    const userPerms = await this.getUserWithPermissions(user);

    if (userPerms.userType === "director") {
      return await this.repo.listByEscuela(userPerms.escuelaId!);
    } else if (userPerms.userType === "encargado") {
      // Listar aulas de todas las escuelas de su zona
      return await this.repo.listByEscuelas(userPerms.allowedEscuelas as string[]);
    } else { // PADI
      // Listar todas las aulas del sistema
      return await this.repo.listAll();
    }
  }

  async update(id: string, data: UpdateAulaData, user: { id: string; rol: string }) {
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    const aula = await prismaAny.aulas.findUnique({
      where: { id },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    // Verificar permisos sobre la escuela del aula
    if (userPerms.userType === "director") {
      if (aula.escuela_id !== userPerms.escuelaId) {
        throw new Error("No tienes permisos para modificar esta aula.");
      }
    } else if (userPerms.userType === "encargado") {
      if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
        throw new Error("No tienes permisos para modificar esta aula.");
      }
    }
    // PADI puede modificar cualquier aula

    return await this.repo.update(id, data);
  }

  async delete(id: string, user: { id: string; rol: string }) {
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    const aula = await prismaAny.aulas.findUnique({
      where: { id },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    // Verificar permisos sobre la escuela del aula
    if (userPerms.userType === "director") {
      if (aula.escuela_id !== userPerms.escuelaId) {
        throw new Error("No tienes permisos para eliminar esta aula.");
      }
    } else if (userPerms.userType === "encargado") {
      if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
        throw new Error("No tienes permisos para eliminar esta aula.");
      }
    }
    // PADI puede eliminar cualquier aula

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
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    // Verificar permisos sobre la escuela del aula
    if (userPerms.userType === "director") {
      if (aula.escuela_id !== userPerms.escuelaId) {
        throw new Error("No tienes permisos para ver los docentes de esta aula.");
      }
    } else if (userPerms.userType === "encargado") {
      if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
        throw new Error("No tienes permisos para ver los docentes de esta aula.");
      }
    }
    // PADI puede ver cualquier aula

    return this.profAulaRepo.listByAula(aulaId);
  }

  async asignarDocente(aulaId: string, profesorId: string, user: { id: string; rol: string }) {
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    // Verificar permisos sobre la escuela del aula
    if (userPerms.userType === "director") {
      if (aula.escuela_id !== userPerms.escuelaId) {
        throw new Error("No tienes permisos para gestionar docentes de esta aula.");
      }
    } else if (userPerms.userType === "encargado") {
      if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
        throw new Error("No tienes permisos para gestionar docentes de esta aula.");
      }
    }
    // PADI puede gestionar cualquier aula

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
    const userPerms = await this.getUserWithPermissions(user);
    const { prismaAny } = userPerms;

    const aula = await prismaAny.aulas.findUnique({
      where: { id: aulaId },
      select: { id: true, escuela_id: true },
    });

    if (!aula) {
      throw new Error("Aula no encontrada.");
    }

    // Verificar permisos sobre la escuela del aula
    if (userPerms.userType === "director") {
      if (aula.escuela_id !== userPerms.escuelaId) {
        throw new Error("No tienes permisos para gestionar docentes de esta aula.");
      }
    } else if (userPerms.userType === "encargado") {
      if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
        throw new Error("No tienes permisos para gestionar docentes de esta aula.");
      }
    }
    // PADI puede gestionar cualquier aula

    await this.profAulaRepo.remove(profesorId, aulaId);
  }

  async listDocenteAulas(user: { id: string; rol: string }) {
    if (user.rol !== "docente") {
      throw new Error("No tienes permisos para ver tus aulas.");
    }

    return await this.repo.listByProfesor(user.id);
  }
}


