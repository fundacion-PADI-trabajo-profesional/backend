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

  async listByProfesor(profesor_id: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to list docente aulas");

    const prismaAny = prisma as any;

    const asignaciones = await prismaAny.profesoresAulas.findMany({
      where: {
        profesor_id,
        fecha_fin: null,
      },
      include: {
        aula: {
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
              },
            },
            estudiantes_aulas: {
              where: { fecha_fin: null },
              include: {
                estudiante: {
                  include: {
                    personas: {
                      select: {
                        id: true,
                        nombre: true,
                        primer_apellido: true,
                        segundo_apellido: true,
                        dni: true,
                        fecha_nacimiento: true,
                      },
                    },
                    generos: {
                      select: {
                        id: true,
                        descripcion: true,
                      },
                    },
                    salas: {
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ aula: { escuela_id: "asc" } }, { aula: { sala_id: "asc" } }, { aula: { comision: "asc" } }],
    });

    const byAulaId = new Map<string, any>();
    for (const asignacion of asignaciones) {
      const aula = asignacion.aula;
      if (!aula || byAulaId.has(aula.id)) continue;

      byAulaId.set(aula.id, {
        id: aula.id,
        sala_id: aula.sala_id,
        escuela_id: aula.escuela_id,
        comision: aula.comision,
        turno: aula.turno,
        fecha_creacion: aula.fecha_creacion,
        sala: aula.sala,
        escuela: aula.escuela,
        estudiantes: (aula.estudiantes_aulas || []).map((ea: any) => ea.estudiante),
      });
    }

    return Array.from(byAulaId.values());
  },
};


