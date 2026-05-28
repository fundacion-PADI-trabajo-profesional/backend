import { withRLSContext } from "../config/prismaClient";
import { DocenteItem } from "../interfaces/docente.interface";

/**
 * Repositorio de acceso a datos para docentes (usuarios con rol `"docente"`).
 */
export const DocenteRepository = {
  /**
   * Lista todos los docentes del sistema con sus asignaciones activas a aulas y escuelas.
   */
  async list(): Promise<DocenteItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).profesores.findMany({
        where: {
          personas: {
            usuario: {
              rol: "docente",
            },
          },
        },
        include: {
          personas: {
            select: {
              nombre: true,
              primer_apellido: true,
            },
          },
          profesores_aulas: {
            where: { fecha_fin: null },
            include: {
              aula: {
                select: {
                  id: true,
                  comision: true,
                  turno: true,
                  sala: {
                    select: {
                      grado: true,
                    },
                  },
                  escuela: {
                    select: {
                      nombre: true,
                    },
                  },
                },
              },
            },
          },
          profesores_escuelas: {
            where: { fecha_fin: null },
            include: {
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: {
          personas: {
            primer_apellido: "asc",
          },
        },
      });
      return rows as DocenteItem[];
    });
  },

  /**
   * Lista los docentes asignados a una escuela específica.
   */
  async listByEscuela(escuelaId: string): Promise<DocenteItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).profesores.findMany({
        where: {
          personas: {
            usuario: {
              rol: "docente",
            },
          },
          profesores_escuelas: {
            some: {
              escuela_id: escuelaId,
              fecha_fin: null,
            },
          },
        },
        include: {
          personas: {
            select: {
              nombre: true,
              primer_apellido: true,
            },
          },
          profesores_aulas: {
            where: { fecha_fin: null },
            include: {
              aula: {
                select: {
                  id: true,
                  comision: true,
                  turno: true,
                  sala: {
                    select: {
                      grado: true,
                    },
                  },
                  escuela: {
                    select: {
                      nombre: true,
                    },
                  },
                },
              },
            },
          },
          profesores_escuelas: {
            where: { fecha_fin: null },
            include: {
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: {
          personas: {
            primer_apellido: "asc",
          },
        },
      });
      return rows as DocenteItem[];
    });
  },

  /**
   * Lista los docentes activos en escuelas de una zona específica.
   */
  async listByZona(zonaId: string): Promise<DocenteItem[]> {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).profesores.findMany({
        where: {
          personas: { usuario: { rol: "docente" } },
          profesores_escuelas: {
            some: {
              fecha_fin: null,
              escuela: { zona_id: zonaId },
            },
          },
        },
        include: {
          personas: {
            select: { nombre: true, primer_apellido: true },
          },
          profesores_aulas: {
            where: { fecha_fin: null },
            include: {
              aula: {
                select: {
                  id: true,
                  comision: true,
                  turno: true,
                  sala: { select: { grado: true } },
                  escuela: { select: { nombre: true } },
                },
              },
            },
          },
          profesores_escuelas: {
            where: { fecha_fin: null },
            include: { escuela: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { personas: { primer_apellido: "asc" } },
      });
      return rows as DocenteItem[];
    });
  },

  /**
   * Asigna un docente a una escuela creando un registro activo en `profesoresEscuelas`.
   */
  async addEscuela(profesorId: string, escuelaId: string) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;

      const existing = await prismaAny.profesoresEscuelas.findFirst({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error("El docente ya está asignado a este colegio.");
      }

      return prismaAny.profesoresEscuelas.create({
        data: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
        },
        include: {
          escuela: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });
    });
  },

  /**
   * Desasigna un docente de una escuela en una transacción atómica.
   */
  async removeEscuela(profesorId: string, escuelaId: string) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;
      const now = new Date();

      const assignment = await prismaAny.profesoresEscuelas.findFirst({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new Error("El docente no está asignado a ese colegio.");
      }

      await prismaAny.profesoresEscuelas.update({
        where: { id: assignment.id },
        data: { fecha_fin: now },
      });

      await prismaAny.profesoresAulas.updateMany({
        where: {
          profesor_id: profesorId,
          fecha_fin: null,
          aula: {
            escuela_id: escuelaId,
          },
        },
        data: {
          fecha_fin: now,
        },
      });
    });
  },

  /**
   * Verifica si un docente tiene una asignación activa a una escuela.
   */
  async hasActiveEscuelaAssignment(profesorId: string, escuelaId: string): Promise<boolean> {
    return withRLSContext(async (tx) => {
      const row = await (tx as any).profesoresEscuelas.findFirst({
        where: {
          profesor_id: profesorId,
          escuela_id: escuelaId,
          fecha_fin: null,
        },
        select: { id: true },
      });
      return Boolean(row);
    });
  },
};
