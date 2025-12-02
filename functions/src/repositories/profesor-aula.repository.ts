import { getPrisma } from "../config/prismaClient";

export const ProfesoresAulasRepository = {
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


