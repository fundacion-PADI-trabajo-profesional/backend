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

    async findByName(nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");

        // Usamos prismaAny para mantener consistencia con tu estilo de código
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findUnique({
            where: { nombre }
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

    async unassignEscuela(escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.update({
            where: { id: escuelaId },
            data: {
                zona_id: null // Volvemos a dejar la escuela "huérfana"
            }
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
    },

    async update(id: string, nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.update({
            where: { id },
            data: { nombre }
        });
    },

    async listEncargadosDisponibles() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.findMany({
            where: {
                zona_id: null // Solo los que no tienen zona asignada
            },
            include: {
                usuario: true // Para mostrar nombre y apellido
            }
        });
    },

    async assignEncargado(zonaId: string, encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.update({
            where: { id: encargadoId },
            data: { zona_id: zonaId }
        });
    },

    async unassignEncargado(encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.update({
            where: { id: encargadoId },
            data: {
                zona_id: null
            }
        });
    }
};