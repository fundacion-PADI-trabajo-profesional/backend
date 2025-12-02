import { PrismaClient } from "@prisma/client";
import { getPrisma } from "../config/prismaClient";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

export const EscuelasRepository = {
    // Busca el perfil de encargado usando el ID de usuario (login)
    async findEncargadoProfile(usuarioId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.encargados.findUnique({
            where: { usuario_id: usuarioId },
            select: { id: true, zona: true }
        });
    },

    async create(data: CreateEscuelaDto) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        try {
            return await prisma.escuelas.create({
                data: {
                    nombre: data.nombre,
                    direccion: data.direccion,
                    telefono: data.telefono,
                    zona: data.zona!, // El signo ! fuerza a TS a confiar en que el service ya validó
                    encargado_id: data.encargado_id
                }
            });
        } catch (error: any) {
            console.error("Error repository create escuela:", error);
            throw new Error("Error al crear la escuela en base de datos.");
        }
    },

    // Lista TODAS las escuelas (Para Equipo PADI)
    async findAll() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.escuelas.findMany({
            include: {
                directivos: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
                profesores: {
                    include: {
                        personas: { select: { nombre: true, primer_apellido: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    // Lista solo escuelas de un encargado específico (Para Encargado Zona)
    async findByEncargadoId(encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.escuelas.findMany({
            where: { encargado_id: encargadoId },
            include: {
                directivos: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    // Lista escuelas por zona (para encargados de esa zona)
    async findByZona(zona: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.escuelas.findMany({
            where: { zona },
            include: {
                directivos: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    async addDocenteRelation(escuelaId: string, profesorId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Usamos 'connect' para crear la relación en la tabla intermedia
        return await prisma.escuelas.update({
            where: { id: escuelaId },
            data: {
                profesores: {
                    connect: { id: profesorId }
                }
            }
        });
    },

    async removeDocenteRelation(escuelaId: string, profesorId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Usamos 'disconnect' para borrar la relación
        return await prisma.escuelas.update({
            where: { id: escuelaId },
            data: {
                profesores: {
                    disconnect: { id: profesorId }
                }
            }
        });
    }
};