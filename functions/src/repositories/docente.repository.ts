import { getPrisma } from "../config/prismaClient";
import { DocenteItem } from "../interfaces/docente.interface";

export const DocenteRepository = {
  async list(): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];

    const rows = await (prisma as any).profesores.findMany({
      where: {
        // Aseguramos que solo traemos profesores cuyo usuario tiene rol 'docente'
        personas: {
          usuario: {
            rol: "docente",
          },
        },
      },
      include: {
        personas: {
          select: {
            nombre: true,
            primer_apellido: true,
          },
        },
        profesores_aulas: {
          where: { fecha_fin: null },
          include: {
            aula: {
              select: {
                id: true,
                comision: true,
                turno: true,
                sala: {
                  select: {
                    grado: true,
                  },
                },
                escuela: {
                  select: {
                    nombre: true,
                  },
                },
              },
            },
          },
        },
        profesores_escuelas: {
          where: { fecha_fin: null },
          include: {
            escuela: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        personas: {
          primer_apellido: "asc",
        },
      },
    });

    return rows as DocenteItem[];
  },

  async listByEscuela(escuelaId: string): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];

    const rows = await (prisma as any).profesores.findMany({
      where: {
        personas: {
          usuario: {
            rol: "docente",
          },
        },
        profesores_escuelas: {
          some: {
            escuela_id: escuelaId,
            fecha_fin: null,
          },
        },
      },
      include: {
        personas: {
          select: {
            nombre: true,
            primer_apellido: true,
          },
        },
        profesores_aulas: {
          where: { fecha_fin: null },
          include: {
            aula: {
              select: {
                id: true,
                comision: true,
                turno: true,
                sala: {
                  select: {
                    grado: true,
                  },
                },
                escuela: {
                  select: {
                    nombre: true,
                  },
                },
              },
            },
          },
        },
        profesores_escuelas: {
          where: { fecha_fin: null },
          include: {
            escuela: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        personas: {
          primer_apellido: "asc",
        },
      },
    });

    return rows as DocenteItem[];
  },

  async addEscuela(profesorId: string, escuelaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const prismaAny = prisma as any;

    const existing = await prismaAny.profesoresEscuelas.findFirst({
      where: {
        profesor_id: profesorId,
        escuela_id: escuelaId,
        fecha_fin: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("El docente ya está asignado a este colegio.");
    }

    return prismaAny.profesoresEscuelas.create({
      data: {
        profesor_id: profesorId,
        escuela_id: escuelaId,
      },
      include: {
        escuela: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
  },

  async removeEscuela(profesorId: string, escuelaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const prismaAny = prisma as any;

    const now = new Date();

    return prismaAny.$transaction(async (tx: any) => {
      const assignment = await tx.profesoresEscuelas.findFirst({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new Error("El docente no está asignado a ese colegio.");
      }

      await tx.profesoresEscuelas.update({
        where: { id: assignment.id },
        data: { fecha_fin: now },
      });

      await tx.profesoresAulas.updateMany({
        where: {
          profesor_id: profesorId,
          fecha_fin: null,
          aula: {
            escuela_id: escuelaId,
          },
        },
        data: {
          fecha_fin: now,
        },
      });
    });
  },

  async hasActiveEscuelaAssignment(profesorId: string, escuelaId: string): Promise<boolean> {
    const prisma = getPrisma();
    if (!prisma) return false;
    const prismaAny = prisma as any;

    const row = await prismaAny.profesoresEscuelas.findFirst({
      where: {
        profesor_id: profesorId,
        escuela_id: escuelaId,
        fecha_fin: null,
      },
      select: { id: true },
    });

    return Boolean(row);
  },
};