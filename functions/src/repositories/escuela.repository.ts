import { withRLSContext, withRLSContextAsAdmin } from "../config/prismaClient";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

/**
 * Repositorio de acceso a datos para la entidad `Escuela`.
 */
export const EscuelasRepository = {
  /**
   * Busca el registro de encargado de zona a partir del UUID de usuario.
   */
  async findEncargadoProfile(usuarioId: string) {
    return withRLSContext(async (tx) => {
      return tx.encargados.findUnique({
        where: { usuario_id: usuarioId },
        include: {
          zona: true,
        },
      });
    });
  },

  /**
   * Crea una escuela nueva en la base de datos.
   */
  async create(data: CreateEscuelaDto) {
    return withRLSContext(async (tx) => {
      try {
        return await tx.escuelas.create({
          data: {
            nombre: data.nombre,
            direccion: data.direccion,
            telefono: data.telefono,
            zona_id: data.zona_id,
            ...(data.nivel_socioeconomico && { nivel_socioeconomico: data.nivel_socioeconomico as any }),
          },
        });
      } catch (error: any) {
        console.error("Error repository create escuela:", error);
        throw new Error("Error al crear la escuela en base de datos.");
      }
    });
  },

  /**
   * Elimina una escuela en una transacción atómica.
   */
  async delete(id: string) {
    return withRLSContext(async (tx) => {
      const now = new Date();

      // 1. Liberar estudiantes
      await tx.estudiantes.updateMany({
        where: { escuela_id: id },
        data: { escuela_id: null },
      });

      // 2. Desasignar directivos
      await tx.usuarioPerfil.updateMany({
        where: { escuela_id: id, rol: "director" },
        data: { escuela_id: null },
      });

      // 3. Cerrar asignaciones docentes
      await tx.profesoresEscuelas.updateMany({
        where: { escuela_id: id, fecha_fin: null },
        data: { fecha_fin: now },
      });

      // Soft delete: conservar escuela y aulas para métricas históricas
      return tx.escuelas.update({
        where: { id },
        data: { desvinculada_at: now },
      });
    });
  },

  /**
   * Transforma el array crudo de Prisma aplanando la relación `profesores_escuelas`
   * en un campo `profesores` con `{ id, personas }` por escuela.
   */
  mapEscuelaDocentes(data: any[]) {
    return data.map((escuela) => ({
      ...escuela,
      profesores: (escuela.profesores_escuelas || [])
        .filter((pe: any) => pe.profesor)
        .map((pe: any) => ({
          id: pe.profesor.id,
          personas: pe.profesor.personas,
        })),
    }));
  },

  /**
   * Actualiza los datos editables de una escuela.
   */
  async update(id: string, data: {
    nombre: string;
    direccion?: string;
    telefono?: string;
    zona_id: string;
    nivel_socioeconomico?: string;
  }) {
    return withRLSContext(async (tx) => {
      try {
        return await tx.escuelas.update({
          where: { id },
          data: {
            nombre: data.nombre,
            direccion: data.direccion,
            telefono: data.telefono,
            zona_id: data.zona_id,
            ...(data.nivel_socioeconomico && { nivel_socioeconomico: data.nivel_socioeconomico as any }),
          },
        });
      } catch (error: any) {
        console.error("Error repository update escuela:", error);
        throw new Error("Error al actualizar la escuela en base de datos.");
      }
    });
  },

  /**
   * Lista todas las escuelas del sistema con zona, directivos, docentes y estudiantes.
   */
  async findAll() {
    return withRLSContext(async (tx) => {

      const rows = await tx.escuelas.findMany({
        where: { desvinculada_at: null },
        include: {
          zona: true,
          directivos: {
            where: { rol: "director" },
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
          profesores_escuelas: {
            where: { fecha_fin: null },
            include: {
              profesor: {
                include: {
                  personas: { select: { nombre: true, primer_apellido: true } },
                },
              },
            },
          },
          estudiantes: {
            where: { fecha_baja: null },
            include: {
              personas: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return this.mapEscuelaDocentes(rows);
    });
  },

  /**
   * Lista las escuelas de una zona específica.
   */
  async findByZonaId(zonaId: string) {
    return withRLSContextAsAdmin(async (tx) => {

      const rows = await tx.escuelas.findMany({
        where: { zona_id: zonaId, desvinculada_at: null },
        include: {
          zona: true,
          directivos: {
            where: { rol: "director" },
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
          profesores_escuelas: {
            where: { fecha_fin: null },
            include: {
              profesor: {
                include: {
                  personas: { select: { nombre: true, primer_apellido: true } },
                },
              },
            },
          },
          estudiantes: {
            where: { fecha_baja: null },
            include: {
              personas: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return this.mapEscuelaDocentes(rows);
    });
  },

  /**
   * Lista las escuelas de una zona buscada por nombre.
   */
  async findByZona(nombreZona: string) {
    return withRLSContext(async (tx) => {

      const rows = await tx.escuelas.findMany({
        where: {
          desvinculada_at: null,
          zona: { nombre: nombreZona },
        },
        include: {
          zona: true,
          directivos: {
            where: { rol: "director" },
            select: { id: true, nombre: true, apellido: true },
          },
          estudiantes: {
            where: { fecha_baja: null },
            include: {
              personas: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return this.mapEscuelaDocentes(rows);
    });
  },

  /**
   * Crea una relación docente-escuela si no existe una activa.
   */
  async addDocenteRelation(escuelaId: string, profesorId: string) {
    return withRLSContext(async (tx) => {

      const existing = await tx.profesoresEscuelas.findFirst({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
      });

      if (!existing) {
        await tx.profesoresEscuelas.create({
          data: {
            profesor_id: profesorId,
            escuela_id: escuelaId,
          },
        });
      }
    });
  },

  /**
   * Cierra la relación docente-escuela y desasigna el docente de todas las aulas
   * de esa escuela en una sola transacción.
   */
  async removeDocenteRelation(escuelaId: string, profesorId: string) {
    return withRLSContext(async (tx) => {
      const now = new Date();

      await tx.profesoresEscuelas.updateMany({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
        data: {
          fecha_fin: now,
        },
      });

      await tx.profesoresAulas.updateMany({
        where: {
          profesor_id: profesorId,
          fecha_fin: null,
          aula: { escuela_id: escuelaId },
        },
        data: {
          fecha_fin: now,
        },
      });
    });
  },

  /**
   * Asigna un directivo a una escuela actualizando su `escuela_id` en `usuarioPerfil`.
   */
  async addDirectivoRelation(escuelaId: string, usuarioId: string) {
    return withRLSContext(async (tx) => {
      return tx.usuarioPerfil.update({
        where: { id: usuarioId },
        data: { escuela_id: escuelaId },
      });
    });
  },

  /**
   * Desasigna un directivo de su escuela poniendo `escuela_id = null`.
   */
  async removeDirectivoRelation(usuarioId: string) {
    return withRLSContext(async (tx) => {
      return tx.usuarioPerfil.update({
        where: { id: usuarioId },
        data: { escuela_id: null },
      });
    });
  },

  /**
   * Retorna las escuelas visibles para un usuario según su rol.
   */
  async getEscuelasParaRol(user: {
    id: string;
    rol: string;
    escuela_id: string | null;
  }): Promise<{ id: string; nombre: string }[]> {
    return withRLSContext(async (tx) => {

      if (user.rol === "director") {
        if (!user.escuela_id) return [];
        const escuela = await tx.escuelas.findUnique({
          where: { id: user.escuela_id },
          select: { id: true, nombre: true },
        });
        return escuela ? [escuela] : [];
      }

      if (user.rol === "encargado_zona") {
        const encargado = await tx.encargados.findUnique({
          where: { usuario_id: user.id },
          select: { zona_id: true },
        });
        if (!encargado?.zona_id) return [];
        return tx.escuelas.findMany({
          where: { zona_id: encargado.zona_id, desvinculada_at: null },
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        });
      }

      // equipo_padi: todas activas
      return tx.escuelas.findMany({
        where: { desvinculada_at: null },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      });
    });
  },
};
