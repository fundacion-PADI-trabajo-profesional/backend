import { getPrisma } from "../config/prismaClient";
import { DocenteItem } from "../interfaces/docente.interface";

/**
 * Repositorio de acceso a datos para docentes (usuarios con rol `"docente"`).
 *
 * @remarks
 * Los docentes se almacenan en la tabla `profesores` y están vinculados a la
 * tabla `personas` (datos personales) y a `usuarioPerfil` (rol y autenticación).
 * Las asignaciones a escuelas y aulas se mantienen con `fecha_fin` para
 * conservar el historial completo de asignaciones.
 */
export const DocenteRepository = {
  /**
   * Lista todos los docentes del sistema con sus asignaciones activas a aulas y escuelas.
   *
   * @returns Array de {@link DocenteItem} ordenado por apellido.
   *          Retorna array vacío si la base de datos no está disponible.
   */
  async list(): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];

    const rows = await (prisma as any).profesores.findMany({
      where: {
        // Aseguramos que solo traemos profesores cuyo usuario tiene rol 'docente'
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
  },

  /**
   * Lista los docentes asignados a una escuela específica.
   *
   * @remarks
   * Filtra por `profesores_escuelas` con `fecha_fin: null` para devolver
   * únicamente asignaciones activas a esa escuela.
   *
   * @param escuelaId - UUID de la escuela.
   * @returns Array de {@link DocenteItem} ordenado por apellido.
   *          Retorna array vacío si la base de datos no está disponible.
   */
  async listByEscuela(escuelaId: string): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];

    const rows = await (prisma as any).profesores.findMany({
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
  },

  /**
   * Lista los docentes activos en escuelas de una zona específica.
   *
   * @param zonaId - UUID de la zona.
   * @returns Array de {@link DocenteItem} con asignaciones activas en escuelas de esa zona.
   */
  async listByZona(zonaId: string): Promise<DocenteItem[]> {
    const prisma = getPrisma();
    if (!prisma) return [];

    const rows = await (prisma as any).profesores.findMany({
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
  },

  /**
   * Asigna un docente a una escuela creando un registro activo en `profesoresEscuelas`.
   *
   * @param profesorId - UUID del docente.
   * @param escuelaId - UUID de la escuela.
   * @returns El registro de asignación creado con datos de la escuela.
   * @throws Error si el docente ya está asignado a esa escuela o si la DB no está disponible.
   */
  async addEscuela(profesorId: string, escuelaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const prismaAny = prisma as any;

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
  },

  /**
   * Desasigna un docente de una escuela en una transacción atómica.
   *
   * @remarks
   * Establece `fecha_fin` en el registro de `profesoresEscuelas` y también
   * cierra todas las asignaciones activas del docente a aulas de esa escuela
   * (`profesoresAulas`), manteniendo el historial.
   *
   * @param profesorId - UUID del docente.
   * @param escuelaId - UUID de la escuela.
   * @throws Error si el docente no está asignado a esa escuela o si la DB no está disponible.
   */
  async removeEscuela(profesorId: string, escuelaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const prismaAny = prisma as any;

    const now = new Date();

    return prismaAny.$transaction(async (tx: any) => {
      const assignment = await tx.profesoresEscuelas.findFirst({
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

      await tx.profesoresEscuelas.update({
        where: { id: assignment.id },
        data: { fecha_fin: now },
      });

      await tx.profesoresAulas.updateMany({
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
   *
   * @param profesorId - UUID del docente.
   * @param escuelaId - UUID de la escuela.
   * @returns `true` si existe una asignación activa; `false` en caso contrario
   *          o si la base de datos no está disponible.
   */
  async hasActiveEscuelaAssignment(profesorId: string, escuelaId: string): Promise<boolean> {
    const prisma = getPrisma();
    if (!prisma) return false;
    const prismaAny = prisma as any;

    const row = await prismaAny.profesoresEscuelas.findFirst({
      where: {
        profesor_id: profesorId,
        escuela_id: escuelaId,
        fecha_fin: null,
      },
      select: { id: true },
    });

    return Boolean(row);
  },
};