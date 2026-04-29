import { getPrisma } from "../config/prismaClient";
import { DirectivoItem } from "../interfaces/directivo.interface";

/**
 * Repositorio de acceso a datos para directivos (usuarios con rol `"director"`).
 *
 * @remarks
 * Los directivos se almacenan en la tabla `usuarioPerfil` con `rol = "director"`.
 * Un directivo puede tener o no una escuela asignada (`escuela_id` nullable).
 */
export const DirectivoRepository = {
  /**
   * Lista todos los directivos del sistema con su escuela asignada (si la tienen).
   *
   * @returns Array de {@link DirectivoItem} ordenado alfabéticamente por apellido y nombre.
   *          Retorna array vacío si la base de datos no está disponible.
   */
    async list(): Promise<DirectivoItem[]> {
        const prisma = getPrisma();
        if (!prisma) return [];

        const rows = await (prisma as any).usuarioPerfil.findMany({
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
    },

  /**
   * Lista los directivos que aún no tienen una escuela asignada.
   *
   * @remarks
   * Usado en el formulario de alta de escuelas para mostrar directivos
   * disponibles para asignar como responsables.
   *
   * @returns Array de {@link DirectivoItem} sin campo `escuela`, ordenado alfabéticamente.
   *          Retorna array vacío si la base de datos no está disponible.
   */
    async listAvailable(): Promise<DirectivoItem[]> {
        const prisma = getPrisma();
        if (!prisma) return [];

        // Solo directivos que NO tienen escuela asignada
        const rows = await (prisma as any).usuarioPerfil.findMany({
            where: {
                rol: "director",
                escuela_id: null
            },
            select: {
                id: true,
                nombre: true,
                apellido: true,
            },
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        });
        return rows as DirectivoItem[];
    },
};


