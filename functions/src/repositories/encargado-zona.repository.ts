import { getPrisma } from "../config/prismaClient";
import { EncargadoItem } from "../interfaces/encargado-zona.interface";

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
                email: true,
                encargado_data: {
                    select: {
                        zona: true
                    }
                }
            },
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        });

        return rows.map((r: any) => ({
            id: r.id,
            nombre: r.nombre,
            apellido: r.apellido,
            email: r.email,
            zona: r.encargado_data?.zona || "Sin asignar" // Si no tiene, ponemos default
        }));
    },
};