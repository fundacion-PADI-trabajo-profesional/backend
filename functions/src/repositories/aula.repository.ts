import { getPrisma } from "../config/prismaClient";

export interface CreateAulaData {
  sala_id: number;
  comision: string;
  turno: string;
  escuela_id: string;
}

export interface UpdateAulaData {
  sala_id?: number;
  comision?: string;
  turno?: string;
}

export const AulasRepository = {
  async create(data: CreateAulaData) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to create Aula");

    const prismaAny = prisma as any;

    const created = await prismaAny.aulas.create({
      data: {
        sala_id: data.sala_id,
        escuela_id: data.escuela_id,
        comision: data.comision,
        turno: data.turno,
      },
    });

    return created;
  },

  async listByEscuela(escuela_id: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to list Aulas");

    const prismaAny = prisma as any;

    const rows = await prismaAny.aulas.findMany({
      where: { escuela_id },
      include: {
        sala: {
          select: {
            id: true,
            nombre: true,
            grado: true,
          },
        },
      },
      orderBy: [{ sala_id: "asc" }, { comision: "asc" }],
    });

    return rows;
  },

  async update(id: string, data: UpdateAulaData) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to update Aula");

    const prismaAny = prisma as any;

    const updated = await prismaAny.aulas.update({
      where: { id },
      data: {
        ...(data.sala_id !== undefined ? { sala_id: data.sala_id } : {}),
        ...(data.comision !== undefined ? { comision: data.comision } : {}),
        ...(data.turno !== undefined ? { turno: data.turno } : {}),
      },
    });

    return updated;
  },

  async listByEscuelas(escuela_ids: string[]) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to list Aulas");

    const prismaAny = prisma as any;

    const rows = await prismaAny.aulas.findMany({
      where: { escuela_id: { in: escuela_ids } },
      include: {
        sala: {
          select: {
            id: true,
            nombre: true,
            grado: true,
          },
        },
        escuela: {
          select: {
            id: true,
            nombre: true,
            zona: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
    });

    return rows;
  },

  async listAll() {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to list Aulas");

    const prismaAny = prisma as any;

    const rows = await prismaAny.aulas.findMany({
      include: {
        sala: {
          select: {
            id: true,
            nombre: true,
            grado: true,
          },
        },
        escuela: {
          select: {
            id: true,
            nombre: true,
            zona: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
    });

    return rows;
  },

  async delete(id: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to delete Aula");

    const prismaAny = prisma as any;

    await prismaAny.aulas.delete({ where: { id } });
  },
};


