import { getPrisma } from "../config/prismaClient";
import { EncargadoItem } from "../interfaces/encargado-zona.interface";

/**
 * Repositorio de acceso a datos para encargados de zona.
 *
 * @remarks
 * Los encargados de zona son usuarios con `rol = "encargado_zona"` en `usuarioPerfil`.
 * Sus datos de zona se almacenan en la tabla `encargados` (relación 1-a-1 con `usuarioPerfil`).
 * Si un encargado no tiene zona asignada, `encargado_data.zona` es `null`.
 */
export const EncargadoRepository = {
  /**
   * Lista todos los encargados de zona con su zona asignada (si la tienen).
   *
   * @returns Array de {@link EncargadoItem} ordenado por apellido y nombre.
   *          Retorna array vacío si la base de datos no está disponible.
   */
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

  /**
   * Actualiza el perfil y la zona asignada de un encargado.
   *
   * @remarks
   * Actualiza primero `usuarioPerfil` (nombre/apellido) y luego `encargados` (zona_id).
   * Las dos actualizaciones no están en una transacción explícita.
   *
   * @param id - UUID del encargado (equivalente al `usuario_id`).
   * @param data - Nuevos valores para nombre, apellido y zona_id.
   * @returns El registro de `encargados` actualizado.
   * @throws Error si la base de datos no está disponible.
   */
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

  /**
   * Obtiene el perfil de un encargado de zona por su UUID de usuario.
   *
   * @param userId - UUID del usuario en Supabase Auth / `usuarioPerfil`.
   * @returns Objeto con id, nombre, apellido, email y zona asignada (`null` si no tiene).
   * @throws Error si el encargado no existe o si la base de datos no está disponible.
   */
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

  /**
   * Elimina un encargado de zona del sistema.
   *
   * @remarks
   * Elimina el registro de `usuarioPerfil`. Si hay restricciones de clave foránea
   * sin `CASCADE`, la operación puede fallar si el encargado aún tiene zona asignada.
   *
   * @param id - UUID del encargado.
   * @throws Error si la base de datos no está disponible.
   */
    async delete(id: string): Promise<void> {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Eliminamos el perfil del usuario. 
        await (prisma as any).usuarioPerfil.delete({
            where: { id }
        });
    }
};