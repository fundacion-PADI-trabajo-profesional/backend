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
                        zona: {
                            select: { id: true, nombre: true }
                        }
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

    async update(id: string, data: { nombre: string; apellido: string; zona_id: string }) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Actualizamos primero el perfil del usuario (Nombre/Apellido)
        await (prisma as any).usuarioPerfil.update({
            where: { id },
            data: {
                nombre: data.nombre,
                apellido: data.apellido
            }
        });

        // Actualizamos la zona en la tabla de datos de encargado
        return await (prisma as any).encargados.update({
            where: { usuario_id: id },
            data: {
                zona_id: data.zona_id
            }
        });
    },

    async getByUserId(userId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const encargado = await (prisma as any).usuarioPerfil.findUnique({
            where: { id: userId, rol: "encargado_zona" },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                encargado_data: {
                    select: {
                        zona: {
                            select: { id: true, nombre: true }
                        }
                    }
                }
            }
        });

        if (!encargado) {
            throw new Error("Encargado no encontrado");
        }

        return {
            id: encargado.id,
            nombre: encargado.nombre,
            apellido: encargado.apellido,
            email: encargado.email,
            zona: encargado.encargado_data?.zona || null
        };
    },

    async delete(id: string): Promise<void> {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Eliminamos el perfil del usuario. 
        await (prisma as any).usuarioPerfil.delete({
            where: { id }
        });
    }
};