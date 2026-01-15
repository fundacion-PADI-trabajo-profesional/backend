import { getPrisma } from "../config/prismaClient";

export const ZonasRepository = {
    async create(nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.create({
            data: { nombre }
        });
    },

    async listAll() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findMany({
            include: {
                _count: {
                    select: { escuelas: true, encargados: true }
                }
            },
            orderBy: { nombre: "asc" }
        });
    },

    async findById(id: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findUnique({
            where: { id },
            include: {
                escuelas: true,
                encargados: {
                    include: { usuario: true } // Para traer nombre/apellido del encargado
                }
            }
        });
    },

    async assignEscuela(zonaId: string, escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.update({
            where: { id: escuelaId },
            data: { zona_id: zonaId }
        });
    },

    async listEscuelasSinZona() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.findMany({
            where: {
                zona_id: null // Solo las que no tienen zona
            },
            orderBy: { nombre: "asc" }
        });
    }
};