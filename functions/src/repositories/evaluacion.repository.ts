import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/prismaClient";

const ESTADO_NO_INICIADA = "N";

console.error("✅ CARGUE evaluacion.repository.ts (SRC)");


export const EvaluacionRepository = {
  async findEstudianteByDni(dni: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const txAny = prisma as any;
    return await txAny.estudiantes.findFirst({
      where: { personas: { dni } },
      select: { id: true, sala_id: true }
    });
  },

  async create(data: {
    estudiante_id: string;
    profesor_id: string;
    sala_id: number;
    tipo_id: string;
    fecha_creacion: Date;
  }) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    return await prisma.$transaction(async (tx) => {
      const txAny = tx as any;

      const evaluacion = await txAny.evaluacionEstudiante.create({
        data: {
          estudiante_id: data.estudiante_id,
          profesor_id: data.profesor_id,
          sala_id: data.sala_id,
          tipo_id: data.tipo_id,
          estado_id: ESTADO_NO_INICIADA,
          fecha_creacion: data.fecha_creacion,
        }
      });

      const todasLasAreas = await txAny.areas.findMany({
        orderBy: { orden: 'asc' }
      });

      const areasData = todasLasAreas.map((area: any) => ({
        evaluacion_estudiante_id: evaluacion.id,
        area_id: area.id,
        estado_id: ESTADO_NO_INICIADA,
        puntaje: 0
      }));

      await txAny.evaluacionesEstudianteArea.createMany({
        data: areasData
      });

      return evaluacion;
    });
  },

  async findAllByProfesor(profesor_id: string) {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findMany({
      where: { profesor_id },
      include: {
        estudiantes: {
          include: {
            personas: { select: { nombre: true, primer_apellido: true } },
            escuela: { select: { nombre: true } },
            salas: { select: { nombre: true } }
          }
        },
        tipos_evaluacion: { select: { descripcion: true } },
        estados_evaluacion: { select: { descripcion: true } }
      },
      orderBy: { fecha_creacion: 'desc' }
    });
  },

  // Lista global para Administradores
  async list() {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findMany({
      include: this._commonIncludes(),
      orderBy: { fecha_creacion: 'desc' }
    });
  },

  // Lista filtrada por Escuela para Directores y Docentes
  async listByEscuela(escuelaId: string) {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findMany({
      where: {
        estudiantes: { escuela_id: escuelaId }
      },
      include: this._commonIncludes(),
      orderBy: { fecha_creacion: 'desc' }
    });
  },

  async findById(id: string) {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findUnique({
      where: { id },
      include: {
        estudiantes: {
          include: {
            personas: true,
            salas: true,
            escuela: { select: { nombre: true } }
          }
        },
        evaluaciones_estudiante_area: {
          include: {
            areas: true,
            estados_evaluacion: true
          },
          orderBy: { areas: { orden: 'asc' } }
        }
      }
    });
  },

  async delete(id: string) {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.delete({
      where: { id }
    });
  },

  // Helper para mantener los joins consistentes
  _commonIncludes() {
    return {
      estudiantes: {
        include: {
          personas: { select: { nombre: true, primer_apellido: true } },
          escuela: { select: { nombre: true } },
          salas: { select: { nombre: true } }
        }
      },
      tipos_evaluacion: { select: { descripcion: true } },
      estados_evaluacion: { select: { descripcion: true } }
    };
  }

};