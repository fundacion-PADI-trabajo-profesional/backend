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
            include: {
                zona: true
            }
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
                    zona_id: data.zona_id,
                    encargado_id: data.encargado_id
                }
            });
        } catch (error: any) {
            console.error("Error repository create escuela:", error);
            throw new Error("Error al crear la escuela en base de datos.");
        }
    },

    async delete(id: string) {
        const prisma = getPrisma();

        // Usamos una transacción para asegurar que los alumnos queden 
        // desvinculados antes de borrar la escuela.
        return await (prisma as any).$transaction([
            // 1. Dejar a los alumnos de esta escuela "Sin Escuela"
            (prisma as any).estudiantes.updateMany({
                where: { escuela_id: id },
                data: { escuela_id: null }
            }),
            // 2. Borrar la escuela
            (prisma as any).escuelas.delete({
                where: { id }
            })
        ]);
    },

    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string
    }) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        try {
            return await prisma.escuelas.update({
                where: { id },
                data: {
                    nombre: data.nombre,
                    direccion: data.direccion,
                    telefono: data.telefono,
                    zona_id: data.zona_id
                }
            });
        } catch (error: any) {
            console.error("Error repository update escuela:", error);
            // Si el error es porque la zona_id no existe, Prisma lanzará una excepción de clave foránea
            throw new Error("Error al actualizar la escuela en base de datos.");
        }
    },

    // Lista TODAS las escuelas (Para Equipo PADI)
    async findAll() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.escuelas.findMany({
            include: {
                zona: true,
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
    async findByZona(nombreZona: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.escuelas.findMany({
            where: {
                zona: {
                    nombre: nombreZona
                }
            },
            include: {
                zona: true, // Incluimos para que el front reciba el objeto
                directivos: {
                    select: { id: true, nombre: true, apellido: true },
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