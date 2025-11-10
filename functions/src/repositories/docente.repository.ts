import { getPrisma } from "../config/prismaClient";

export interface DocenteItem {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
}

export const DocenteRepository = {
  async list(): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];
    // UsuarioPerfil está mapeado a la tabla 'usuarios' y contiene rol
    const rows = await (prisma as any).usuarioPerfil.findMany({
      where: { rol: "docente" },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });
    return rows as DocenteItem[];
  },
};


