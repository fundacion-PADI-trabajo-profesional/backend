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
      },
      orderBy: {
        personas: {
          primer_apellido: "asc",
        },
      },
    });

    return rows as DocenteItem[];
  },
};