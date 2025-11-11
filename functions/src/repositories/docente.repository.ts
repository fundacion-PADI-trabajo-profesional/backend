import { getPrisma } from "../config/prismaClient";

export interface DocenteItem {
  id: string;
  nombre: string;
  apellido: string;
}

export const DocenteRepository = {
  async list(): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];
    // Listar docentes desde 'usuarios' (UsuarioPerfil) por ahora,
    // para garantizar resultados aunque 'profesores' no esté poblado todavía.
    const rows = await (prisma as any).usuarioPerfil.findMany({
      where: { rol: "docente" },
      select: {
        id: true,
        nombre: true,
        apellido: true,
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });
    return rows as DocenteItem[];
  },
};


