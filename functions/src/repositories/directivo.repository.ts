import { withRLSContext } from "../config/prismaClient";
import { DirectivoItem } from "../interfaces/directivo.interface";

/**
 * Repositorio de acceso a datos para directivos (usuarios con rol `"director"`).
 */
export const DirectivoRepository = {
  /**
   * Lista todos los directivos del sistema con su escuela asignada (si la tienen).
   */
  async list(): Promise<DirectivoItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).usuarioPerfil.findMany({
        where: { rol: "director" },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          escuela: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      });
      return rows as DirectivoItem[];
    });
  },

  /**
   * Lista los directivos que aún no tienen una escuela asignada.
   */
  async listAvailable(): Promise<DirectivoItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).usuarioPerfil.findMany({
        where: {
          rol: "director",
          escuela_id: null,
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      });
      return rows as DirectivoItem[];
    });
  },
};
