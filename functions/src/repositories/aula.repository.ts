import { withRLSContext } from "../config/prismaClient";

/**
 * Datos requeridos para crear un aula nueva.
 */
export interface CreateAulaData {
  /** ID numérico de la sala (p. ej. 3, 4 o 5). */
  sala_id: number;
  /** Comisión del aula (p. ej. `"A"`, `"B"`). */
  comision: string;
  /** Turno del aula (p. ej. `"Mañana"`, `"Tarde"`). */
  turno: string;
  /** UUID de la escuela a la que pertenece el aula. */
  escuela_id: string;
}

/**
 * Campos actualizables de un aula existente (todos opcionales).
 */
export interface UpdateAulaData {
  /** Nuevo ID de sala. */
  sala_id?: number;
  /** Nueva comisión. */
  comision?: string;
  /** Nuevo turno. */
  turno?: string;
}

/**
 * Repositorio de acceso a datos para la entidad `Aula`.
 *
 * @remarks
 * Cada método envuelve las operaciones en {@link withRLSContext} para aplicar
 * las políticas de Row Level Security de PostgreSQL.
 */
export const AulasRepository = {
  /**
   * Crea un aula nueva en la base de datos.
   */
  async create(data: CreateAulaData) {
    return withRLSContext(async (tx) => {
      return tx.aulas.create({
        data: {
          sala_id: data.sala_id,
          escuela_id: data.escuela_id,
          comision: data.comision,
          turno: data.turno,
        },
      });
    });
  },

  /**
   * Lista todas las aulas de una escuela, incluyendo sala y docentes asignados.
   */
  async listByEscuela(escuela_id: string) {
    return withRLSContext(async (tx) => {
      return tx.aulas.findMany({
        where: { escuela_id },
        include: {
          sala: {
            select: {
              id: true,
              nombre: true,
              grado: true,
            },
          },
          profesores_aulas: {
            select: {
              profesor_id: true,
              profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
            },
          },
        },
        orderBy: [{ sala_id: "asc" }, { comision: "asc" }],
      });
    });
  },

  /**
   * Actualiza los campos de un aula existente.
   */
  async update(id: string, data: UpdateAulaData) {
    return withRLSContext(async (tx) => {
      return tx.aulas.update({
        where: { id },
        data: {
          ...(data.sala_id !== undefined ? { sala_id: data.sala_id } : {}),
          ...(data.comision !== undefined ? { comision: data.comision } : {}),
          ...(data.turno !== undefined ? { turno: data.turno } : {}),
        },
      });
    });
  },

  /**
   * Lista aulas de múltiples escuelas (para encargados de zona).
   */
  async listByEscuelas(escuela_ids: string[]) {
    return withRLSContext(async (tx) => {
      return tx.aulas.findMany({
        where: { escuela_id: { in: escuela_ids } },
        include: {
          sala: {
            select: {
              id: true,
              nombre: true,
              grado: true,
            },
          },
          escuela: {
            select: {
              id: true,
              nombre: true,
              zona: {
                select: {
                  nombre: true,
                },
              },
            },
          },
          profesores_aulas: {
            select: {
              profesor_id: true,
              profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
            },
          },
        },
        orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
      });
    });
  },

  /**
   * Lista todas las aulas del sistema (uso exclusivo del rol `admin`).
   */
  async listAll() {
    return withRLSContext(async (tx) => {
      return tx.aulas.findMany({
        include: {
          sala: {
            select: {
              id: true,
              nombre: true,
              grado: true,
            },
          },
          escuela: {
            select: {
              id: true,
              nombre: true,
              zona: {
                select: {
                  nombre: true,
                },
              },
            },
          },
          profesores_aulas: {
            select: {
              profesor_id: true,
              profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
            },
          },
        },
        orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
      });
    });
  },

  /**
   * Elimina un aula de la base de datos.
   */
  async delete(id: string) {
    return withRLSContext(async (tx) => {
      await tx.aulas.delete({ where: { id } });
    });
  },

  /**
   * Lista las aulas asignadas a un docente, incluyendo los estudiantes activos
   * y el resumen de evaluaciones de cada uno.
   */
  async listByProfesor(profesor_id: string) {
    return withRLSContext(async (tx) => {

      const asignaciones = await tx.profesoresAulas.findMany({
        where: {
          profesor_id,
          fecha_fin: null,
        },
        include: {
          aula: {
            include: {
              sala: {
                select: {
                  id: true,
                  nombre: true,
                  grado: true,
                },
              },
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              estudiantes_aulas: {
                where: { fecha_fin: null },
                include: {
                  estudiante: {
                    include: {
                      personas: {
                        select: {
                          id: true,
                          nombre: true,
                          primer_apellido: true,
                          segundo_apellido: true,
                          dni: true,
                          fecha_nacimiento: true,
                        },
                      },
                      generos: {
                        select: {
                          id: true,
                          descripcion: true,
                        },
                      },
                      salas: {
                        select: {
                          id: true,
                          nombre: true,
                          grado: true,
                        },
                      },
                      escuela: {
                        select: {
                          id: true,
                          nombre: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ aula: { escuela_id: "asc" } }, { aula: { sala_id: "asc" } }, { aula: { comision: "asc" } }],
      });

      const byAulaId = new Map<string, any>();
      for (const asignacion of asignaciones) {
        const aula = asignacion.aula;
        if (!aula || byAulaId.has(aula.id)) continue;

        byAulaId.set(aula.id, {
          id: aula.id,
          sala_id: aula.sala_id,
          escuela_id: aula.escuela_id,
          comision: aula.comision,
          turno: aula.turno,
          fecha_creacion: aula.fecha_creacion,
          sala: aula.sala,
          escuela: aula.escuela,
          estudiantes: (aula.estudiantes_aulas || []).map((ea: any) => ea.estudiante),
        });
      }
      const aulas = Array.from(byAulaId.values());
      const estudianteIds = aulas.flatMap((aula: any) => (aula.estudiantes || []).map((e: any) => e.id));

      const resumenPorEstudiante = new Map<string, { inicial: string | null; cierre: string | null }>();
      if (estudianteIds.length > 0) {
        const evalRows = await tx.evaluacionEstudiante.findMany({
          where: {
            estudiante_id: { in: estudianteIds },
            tipo_id: { in: ["inicial", "cierre"] },
          },
          select: {
            estudiante_id: true,
            tipo_id: true,
            estado_id: true,
            fecha_creacion: true,
            id: true,
          },
          orderBy: [{ fecha_creacion: "desc" }, { id: "desc" }],
        });

        for (const row of evalRows) {
          const current = resumenPorEstudiante.get(row.estudiante_id) || { inicial: null, cierre: null };
          if (row.tipo_id === "inicial" && current.inicial === null) current.inicial = row.estado_id;
          if (row.tipo_id === "cierre" && current.cierre === null) current.cierre = row.estado_id;
          resumenPorEstudiante.set(row.estudiante_id, current);
        }
      }

      return aulas.map((aula: any) => ({
        ...aula,
        estudiantes: (aula.estudiantes || []).map((est: any) => ({
          ...est,
          evaluaciones_resumen: resumenPorEstudiante.get(est.id) ?? { inicial: null, cierre: null },
        })),
      }));
    });
  },

  /**
   * Lista los estudiantes actualmente asignados a un aula específica.
   */
  async listEstudiantesByAula(aula_id: string) {
    return withRLSContext(async (tx) => {

      const asignaciones = await tx.estudiantesAulas.findMany({
        where: {
          aula_id,
          fecha_fin: null,
        },
        include: {
          estudiante: {
            include: {
              personas: {
                select: {
                  id: true,
                  nombre: true,
                  primer_apellido: true,
                  segundo_apellido: true,
                  dni: true,
                  fecha_nacimiento: true,
                },
              },
              generos: {
                select: {
                  id: true,
                  descripcion: true,
                },
              },
              salas: {
                select: {
                  id: true,
                  nombre: true,
                  grado: true,
                },
              },
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: [{ estudiante: { personas: { primer_apellido: "asc" } } }, { estudiante: { personas: { nombre: "asc" } } }],
      });

      return asignaciones.map((ea: any) => ea.estudiante);
    });
  },

  /**
   * Agrega un estudiante a un aula creando un registro activo en `estudiantesAulas`.
   */
  async addEstudiante(estudianteId: string, aulaId: string) {
    return withRLSContext(async (tx) => {

      const existing = await tx.estudiantesAulas.findFirst({
        where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
      });
      if (existing) {
        throw new Error("El estudiante ya está asignado a esta aula.");
      }

      return tx.estudiantesAulas.create({
        data: { estudiante_id: estudianteId, aula_id: aulaId },
      });
    });
  },

  /**
   * Desasigna un estudiante de un aula estableciendo `fecha_fin` en la asignación activa.
   */
  async removeEstudiante(estudianteId: string, aulaId: string) {
    return withRLSContext(async (tx) => {

      const assignment = await tx.estudiantesAulas.findFirst({
        where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
      });
      if (!assignment) {
        throw new Error("El estudiante no está asignado a esta aula.");
      }

      return tx.estudiantesAulas.update({
        where: { id: assignment.id },
        data: { fecha_fin: new Date() },
      });
    });
  },
};
