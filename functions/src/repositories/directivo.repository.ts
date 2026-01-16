import { getPrisma } from "../config/prismaClient";
import { DirectivoItem } from "../interfaces/directivo.interface";

export const DirectivoRepository = {
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


