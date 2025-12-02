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
};


