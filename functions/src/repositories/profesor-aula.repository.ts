import { getPrisma } from "../config/prismaClient";

/**
 * Repositorio de acceso a datos para la relación docente-aula (`profesoresAulas`).
 *
 * @remarks
 * Gestiona la asignación de docentes a aulas específicas.
 * Un docente puede estar asignado a múltiples aulas y un aula puede tener
 * múltiples docentes. La tabla `profesoresAulas` no usa `fecha_fin` para
 * el historial — las asignaciones se eliminan directamente.
 */
export const ProfesoresAulasRepository = {
  /**
   * Asigna un docente a un aula creando un registro en `profesoresAulas`.
   *
   * @param profesorId - UUID del docente.
   * @param aulaId - UUID del aula.
   * @returns El registro de asignación creado.
   * @throws Error si la base de datos no está disponible.
   */
  async add(profesorId: string, aulaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const prismaAny = prisma as any;

    return prismaAny.profesoresAulas.create({
      data: {
        profesor_id: profesorId,
        aula_id: aulaId,
      },
    });
  },

  /**
   * Elimina la asignación de un docente a un aula.
   *
   * @param profesorId - UUID del docente.
   * @param aulaId - UUID del aula.
   * @returns El resultado de `deleteMany` (incluye `count` de registros eliminados).
   * @throws Error si la base de datos no está disponible.
   */
  async remove(profesorId: string, aulaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const prismaAny = prisma as any;

    return prismaAny.profesoresAulas.deleteMany({
      where: {
        profesor_id: profesorId,
        aula_id: aulaId,
      },
    });
  },

  /**
   * Lista los docentes asignados a un aula específica.
   *
   * @param aulaId - UUID del aula.
   * @returns Array de asignaciones con datos del docente (nombre y primer apellido via `personas`).
   * @throws Error si la base de datos no está disponible.
   */
  async listByAula(aulaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const prismaAny = prisma as any;

    return prismaAny.profesoresAulas.findMany({
      where: { aula_id: aulaId },
      include: {
        profesor: {
          include: {
            personas: {
              select: {
                nombre: true,
                primer_apellido: true,
              },
            },
          },
        },
      },
    });
  },
};


