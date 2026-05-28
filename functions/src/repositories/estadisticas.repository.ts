import { withRLSContext } from "../config/prismaClient";

export const EstadisticasRepository = {
  async findAreas() {
    return withRLSContext(async (tx) => {
      return (tx as any).areas.findMany({
        select: { id: true, nombre: true, orden: true },
        orderBy: { orden: "asc" },
      });
    });
  },

  async findReglasAprobacion() {
    return withRLSContext(async (tx) => {
      return (tx as any).reglasAprobacion.findMany({
        select: { area_id: true, sala_id: true, puntaje_total: true },
      });
    });
  },

  async findEvaluacionesParaHeatmap(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    tipo: string;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;

      const where: any = {
        tipo_id: filtros.tipo,
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };

      if (filtros.zonaId) {
        where.OR = [
          { aulas: { escuela: { zona_id: filtros.zonaId } } },
          { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
        ];
      }

      if (filtros.escuelaId) {
        where.OR = [
          { aulas: { escuela_id: filtros.escuelaId } },
          { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
        ];
      }

      return prismaAny.evaluacionEstudiante.findMany({
        where,
        select: {
          id: true,
          aula_id: true,
          sala_id: true,
          aulas: {
            select: {
              id: true,
              comision: true,
              turno: true,
              escuela_id: true,
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                  zona_id: true,
                  desvinculada_at: true,
                  zona: { select: { id: true, nombre: true } },
                },
              },
            },
          },
          estudiantes: {
            select: {
              escuela_id: true,
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                  zona_id: true,
                  desvinculada_at: true,
                  zona: { select: { id: true, nombre: true } },
                },
              },
            },
          },
          evaluaciones_estudiante_area: {
            where: { estado_id: { in: ["A", "D"] } },
            select: { area_id: true, puntaje: true },
          },
        },
      });
    });
  },

  async findEvaluacionesParaRiesgo(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;

      const where: any = {
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };

      if (filtros.zonaId) {
        where.OR = [
          { aulas: { escuela: { zona_id: filtros.zonaId } } },
          { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
        ];
      }

      if (filtros.escuelaId) {
        where.OR = [
          { aulas: { escuela_id: filtros.escuelaId } },
          { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
        ];
      }

      return prismaAny.evaluacionEstudiante.findMany({
        where,
        select: {
          id: true,
          sala_id: true,
          aula_id: true,
          estudiante_id: true,
          aulas: {
            select: {
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                  desvinculada_at: true,
                  zona: { select: { nombre: true } },
                },
              },
            },
          },
          estudiantes: {
            select: {
              escuela_id: true,
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                  desvinculada_at: true,
                  zona: { select: { nombre: true } },
                },
              },
              personas: { select: { nombre: true, primer_apellido: true } },
            },
          },
          evaluaciones_estudiante_area: {
            where: { estado_id: { in: ["A", "D"] } },
            select: { area_id: true, puntaje: true },
          },
        },
      });
    });
  },

  async findEvaluacionesPorNivelSocioeconomico(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    tipo: string;
  }) {
    return withRLSContext(async (tx) => {
      return (tx as any).evaluacionEstudiante.findMany({
        where: {
          tipo_id: filtros.tipo,
          fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
        },
        select: {
          id: true,
          aula_id: true,
          sala_id: true,
          aulas: {
            select: {
              escuela: {
                select: {
                  id: true,
                  nivel_socioeconomico: true,
                },
              },
            },
          },
          estudiantes: {
            select: {
              escuela: {
                select: {
                  id: true,
                  nivel_socioeconomico: true,
                },
              },
            },
          },
          evaluaciones_estudiante_area: {
            where: { estado_id: { in: ["A", "D"] } },
            select: { area_id: true, puntaje: true },
          },
        },
      });
    });
  },

  async findZonaIdDeEncargado(usuarioId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const enc = await (tx as any).encargados.findUnique({
        where: { usuario_id: usuarioId },
        select: { zona_id: true },
      });
      return enc?.zona_id ?? null;
    });
  },

  async findProfesorIdDeUsuario(usuarioId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const persona = await (tx as any).personas.findUnique({
        where: { usuario_id: usuarioId },
        select: { profesores: { select: { id: true }, take: 1 } },
      });
      return persona?.profesores?.[0]?.id ?? null;
    });
  },

  async findAulaDelProfesor(profesorId: string, aulaId: string): Promise<boolean> {
    return withRLSContext(async (tx) => {
      const entry = await (tx as any).profesoresAulas.findFirst({
        where: { profesor_id: profesorId, aula_id: aulaId, fecha_fin: null },
      });
      return entry != null;
    });
  },

  async findRespuestasPorAula(filtros: {
    aulaId: string;
    periodoStart: Date;
    periodoEnd: Date;
    areaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      return (tx as any).evaluacionEstudiante.findMany({
        where: {
          aula_id: filtros.aulaId,
          fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
        },
        select: {
          evaluaciones_estudiante_area: {
            where: {
              estado_id: { in: ["A", "D"] },
              ...(filtros.areaId ? { area_id: filtros.areaId } : {}),
            },
            select: {
              evaluaciones_estudiante_area_preguntas: {
                select: {
                  pregunta_id: true,
                  respuesta: true,
                  preguntas: {
                    select: { id: true, consigna: true, titulo: true, area_id: true },
                  },
                },
              },
            },
          },
        },
      });
    });
  },

  async findEvaluacionesParaAula(filtros: {
    aulaId: string;
    periodoStart: Date;
    periodoEnd: Date;
  }) {
    return withRLSContext(async (tx) => {
      return (tx as any).evaluacionEstudiante.findMany({
        where: {
          aula_id: filtros.aulaId,
          fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
        },
        select: {
          id: true,
          sala_id: true,
          estudiante_id: true,
          evaluaciones_estudiante_area: {
            where: { estado_id: { in: ["A", "D"] } },
            select: { area_id: true, puntaje: true },
          },
        },
      });
    });
  },

  async findActividadDocentes(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      const prismaAny = tx as any;
      const where: any = {
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };
      if (filtros.zonaId) {
        where.OR = [
          { aulas: { escuela: { zona_id: filtros.zonaId } } },
          { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
        ];
      }
      if (filtros.escuelaId) {
        where.OR = [
          { aulas: { escuela_id: filtros.escuelaId } },
          { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
        ];
      }
      return prismaAny.evaluacionEstudiante.findMany({
        where,
        select: {
          profesor_id: true,
          profesores: {
            select: {
              personas: { select: { nombre: true, primer_apellido: true } },
            },
          },
        },
      });
    });
  },

  async findEvaluacionesPorZona(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
  }) {
    return withRLSContext(async (tx) => {
      return (tx as any).evaluacionEstudiante.findMany({
        where: { fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd } },
        select: {
          estudiante_id: true,
          aulas: {
            select: {
              escuela: {
                select: {
                  zona_id: true,
                  zona: { select: { id: true, nombre: true } },
                },
              },
            },
          },
          estudiantes: {
            select: {
              escuela: {
                select: {
                  zona_id: true,
                  zona: { select: { id: true, nombre: true } },
                },
              },
            },
          },
        },
      });
    });
  },

  async findZonaIdDeEscuela(escuelaId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const esc = await (tx as any).escuelas.findUnique({
        where: { id: escuelaId },
        select: { zona_id: true },
      });
      return esc?.zona_id ?? null;
    });
  },

  async findUltimasEvaluaciones(filtros: {
    estudianteId: string;
    limit: number;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await (tx as any).evaluacionEstudiante.findMany({
        where: { estudiante_id: filtros.estudianteId },
        select: {
          id: true,
          sala_id: true,
          tipo_id: true,
          fecha_creacion: true,
          evaluaciones_estudiante_area: {
            where: { estado_id: { in: ["A", "D"] } },
            select: { area_id: true, puntaje: true },
          },
        },
        orderBy: { fecha_creacion: "desc" },
        take: filtros.limit,
      });
      // invertir para orden cronológico ascendente
      return rows.reverse();
    });
  },

  async findEstudianteEnEscuela(
    estudianteId: string,
    escuelaId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await (tx as any).estudiantes.findFirst({
        where: { id: estudianteId, escuela_id: escuelaId },
        select: { personas: { select: { nombre: true, primer_apellido: true } } },
      });
      return est
        ? { nombre: est.personas?.nombre ?? null, primer_apellido: est.personas?.primer_apellido ?? null }
        : null;
    });
  },

  async findEstudianteEnAulasDeProfesor(
    estudianteId: string,
    profesorId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await (tx as any).estudiantes.findFirst({
        where: {
          id: estudianteId,
          aulas: {
            some: {
              aula: { profesores_aulas: { some: { profesor_id: profesorId } } },
            },
          },
        },
        select: { personas: { select: { nombre: true, primer_apellido: true } } },
      });
      return est
        ? { nombre: est.personas?.nombre ?? null, primer_apellido: est.personas?.primer_apellido ?? null }
        : null;
    });
  },

  async findEstudianteEnAula(
    estudianteId: string,
    aulaId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await (tx as any).estudiantes.findFirst({
        where: {
          id: estudianteId,
          aulas: { some: { aula_id: aulaId } },
        },
        select: { personas: { select: { nombre: true, primer_apellido: true } } },
      });
      return est
        ? { nombre: est.personas?.nombre ?? null, primer_apellido: est.personas?.primer_apellido ?? null }
        : null;
    });
  },
};
