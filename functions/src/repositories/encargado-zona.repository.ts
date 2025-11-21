import { getPrisma } from "../config/prismaClient";

export interface EncargadoItem {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
}

export const EncargadoRepository = {
    async list(): Promise<EncargadoItem[]> {
        const prisma = getPrisma();
        if (!prisma) return [];

        const rows = await (prisma as any).usuarioPerfil.findMany({
            where: { rol: "encargado_zona" },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true, // Agregué email porque es útil verlo en la tabla
            },
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        });

        return rows as EncargadoItem[];
    },
};