import { withRLSContext } from "../config/prismaClient";
import { EncargadoItem } from "../interfaces/encargado-zona.interface";

/**
 * Repositorio de acceso a datos para encargados de zona.
 */
export const EncargadoRepository = {
  /**
   * Lista todos los encargados de zona con su zona asignada (si la tienen).
   */
  async list(): Promise<EncargadoItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).usuarioPerfil.findMany({
        where: { rol: "encargado_zona" },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          encargado_data: {
            select: {
              zona: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      });

      return rows.map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        apellido: r.apellido,
        email: r.email,
        zona: r.encargado_data?.zona || "Sin asignar",
      }));
    });
  },

  /**
   * Actualiza el perfil y la zona asignada de un encargado.
   */
  async update(id: string, data: { nombre: string; apellido: string; zona_id: string }) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;

      await prismaAny.usuarioPerfil.update({
        where: { id },
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
        },
      });

      return prismaAny.encargados.update({
        where: { usuario_id: id },
        data: {
          zona_id: data.zona_id,
        },
      });
    });
  },

  /**
   * Obtiene el perfil de un encargado de zona por su UUID de usuario.
   */
  async getByUserId(userId: string) {
    return withRLSContext(async (tx) => {
      const encargado = await (tx as any).usuarioPerfil.findUnique({
        where: { id: userId, rol: "encargado_zona" },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          encargado_data: {
            select: {
              zona: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
      });

      if (!encargado) {
        throw new Error("Encargado no encontrado");
      }

      return {
        id: encargado.id,
        nombre: encargado.nombre,
        apellido: encargado.apellido,
        email: encargado.email,
        zona: encargado.encargado_data?.zona || null,
      };
    });
  },

  /**
   * Elimina un encargado de zona del sistema.
   */
  async delete(id: string): Promise<void> {
    return withRLSContext(async (tx) => {
      await (tx as any).usuarioPerfil.delete({
        where: { id },
      });
    });
  },
};
