import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ESTADO_NO_INICIADA = "N";

export const EvaluacionRepository = {
  async findEstudianteByDni(dni: string) {
    return await prisma.estudiantes.findFirst({
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
    return await prisma.$transaction(async (tx) => {
      //Crear la evaluación principal
      const evaluacion = await tx.evaluacionEstudiante.create({
        data: {
          estudiante_id: data.estudiante_id,
          profesor_id: data.profesor_id,
          sala_id: data.sala_id,
          tipo_id: data.tipo_id,
          estado_id: ESTADO_NO_INICIADA, // Estado inicial: No Iniciada [cite: 15]
          fecha_creacion: data.fecha_creacion,
        }
      });

      //Obtener todas las áreas disponibles
      const todasLasAreas = await tx.areas.findMany({
        orderBy: { orden: 'asc' }
      });

      //Crear registros de área inicializados en 'N' 
      const areasData = todasLasAreas.map(area => ({
        evaluacion_estudiante_id: evaluacion.id,
        area_id: area.id,
        estado_id: ESTADO_NO_INICIADA, // Cada área nace como "No Iniciada" 
        puntaje: 0
      }));

      await tx.evaluacionesEstudianteArea.createMany({
        data: areasData
      });

      return evaluacion;
    });
  },

  async findAllByProfesor(profesor_id: string) {
    return await prisma.evaluacionEstudiante.findMany({
      where: { profesor_id },
      include: {
        estudiantes: {
          include: {
            personas: { select: { nombre: true, primer_apellido: true } },
            escuelas: { select: { nombre: true } },
            salas: { select: { nombre: true } }
          }
        },
        tipos_evaluacion: { select: { descripcion: true } },
        estados_evaluacion: { select: { descripcion: true } }
      },
      orderBy: { fecha_creacion: 'desc' }
    });
  },

  async findById(id: string) {
    return await prisma.evaluacionEstudiante.findUnique({
      where: { id },
      include: {
        estudiantes: {
          include: {
            personas: true,
            salas: true,
            escuelas: true //creo que esto ralentiza porque te trae toda la info de la escuela en vez de solo lo que se usa.
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
    return await prisma.evaluacionEstudiante.delete({
      where: { id }
    });
  }
};