// Archivo: evaluacion.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"
import {
  CreateEvaluacionData,
  EVALUACION_AREAS,
  ESTADO_NO_INICIADA_ID,
} from "../interfaces/evaluacion.interface"

const TRANSACTION_TIMEOUT_MS = 10000;

export const EvaluacionRepository = {
  // ----------------------------------------------------------------------
  // Funciones de Ayuda (Helpers)
  // ----------------------------------------------------------------------
  async checkProfessorExists(profesorId: string): Promise<boolean> {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to check Professor")

    const professor = await (prisma as any).profesores.findUnique({
      where: { id: profesorId },
      select: { id: true }
    })

    return !!professor
  },

  // ----------------------------------------------------------------------
  // Funciones CRUD
  // ----------------------------------------------------------------------

  async create(data: CreateEvaluacionData) {
    const { dni, tipo_id, profesor_id, fecha_creacion } = data
    const fechaReal = fecha_creacion ? new Date(fecha_creacion) : new Date();
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to create Evaluacion")

    // =======================================================================
    // 0. LECTURAS PREVIAS (FUERA DE LA TRANSACCIÓN)
    //    Esto libera tiempo de la transacción
    // =======================================================================

    // 0.1. Obtener la Sala/Grado del estudiante
    const estudianteData = await (prisma as any).estudiantes.findFirst({
      where: { personas: { dni: dni } },
      select: { id: true, sala_id: true },
    });

    if (!estudianteData) {
      throw new Error(`Estudiante con DNI ${dni} no encontrado.`)
    }
    const estudiante = estudianteData;


    // 0.2. Obtener TODAS las preguntas relevantes de una sola vez
    const allRelevantQuestions = await (prisma as any).preguntas.findMany({
      where: {
        sala_id: estudiante.sala_id,
        activa: true
      },
      select: { id: true, area_id: true }
    });

    // 0.3. Mapear preguntas por área para fácil acceso dentro de la transacción
    const questionsByArea: Record<string, { id: string }[]> = {};
    allRelevantQuestions.forEach((q: { id: string; area_id: string | null }) => {
      if (!questionsByArea[q.area_id!]) {
        questionsByArea[q.area_id!] = [];
      }
      questionsByArea[q.area_id!].push(q as { id: string });
    });


    try {
      // 1. INICIAR TRANSACCIÓN (Ahora más corta y con timeout extendido)
      const result = await prisma.$transaction(async (tx) => {
        const txAny = tx as any

        // 2. Crear la evaluación principal
        const nuevaEvaluacion = await txAny.evaluacionEstudiante.create({
          data: {
            estudiante_id: estudiante.id,
            profesor_id: profesor_id,
            sala_id: estudiante.sala_id,
            tipo_id: tipo_id,
            estado_id: ESTADO_NO_INICIADA_ID,
            fecha_creacion: fechaReal,
          },
        })

        // 3. Crear las 4 entradas en evaluaciones_estudiante_area
        const areasToCreate = EVALUACION_AREAS.map((area) => ({
          evaluacion_estudiante_id: nuevaEvaluacion.id,
          area_id: area.id,
          estado_id: ESTADO_NO_INICIADA_ID,
        }))

        await txAny.evaluacionesEstudianteArea.createMany({
          data: areasToCreate,
        })

        // 4. Obtener las áreas creadas (necesitamos sus IDs)
        const areasCreadas = await txAny.evaluacionesEstudianteArea.findMany({
          where: {
            evaluacion_estudiante_id: nuevaEvaluacion.id,
          },
          select: { id: true, area_id: true }
        })

        // =======================================================================
        // 5. PRE-POBLAR RESPUESTAS (OPTIMIZADO: UNA SOLA INSERCIÓN)
        // =======================================================================

        let allAnswersToCreate: any[] = [];

        for (const area of areasCreadas) {
          const questions = questionsByArea[area.area_id]; // Obtenemos del mapa pre-calculado

          if (questions) {
            const answers = questions.map((q: { id: string }) => ({
              evaluaciones_area_id: area.id,
              pregunta_id: q.id,
              respuesta: null,
            }));
            allAnswersToCreate.push(...answers);
          }
        }

        // C. Insertar en EvaluacionesEstudianteAreaPreguntas (UN SOLO createMany grande)
        if (allAnswersToCreate.length > 0) {
          await txAny.evaluacionesEstudianteAreaPreguntas.createMany({
            data: allAnswersToCreate,
          });
        }

        // =======================================================================
        // 6. Devolver la evaluación creada (con inclusión de áreas)
        // =======================================================================
        // La consulta final debe ser lo más rápida posible.
        const areasDetalle = await txAny.evaluacionesEstudianteArea.findMany({
          where: { evaluacion_estudiante_id: nuevaEvaluacion.id },
          include: {
            areas: { select: { nombre: true } },
            estados_evaluacion: { select: { descripcion: true } },
          }
        })

        // Devolvemos el resultado final
        return {
          ...nuevaEvaluacion,
          areas: areasDetalle,
        }
      }, { timeout: TRANSACTION_TIMEOUT_MS }) // Aplicamos el nuevo timeout

      return result
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new Error("El tipo de evaluación o profesor no existe.")
        }
      }
      console.error("Error en transacción createEvaluacion (Backend):", error)
      const errorMessage = error instanceof Error ? error.message : "Error al crear la evaluación."
      // Capturamos explícitamente el error de timeout y lo informamos
      if (errorMessage.includes("Transaction already closed") || errorMessage.includes("timeout")) {
        throw new Error("Timeout de DB excedido (" + TRANSACTION_TIMEOUT_MS / 1000 + "s). Intente nuevamente o optimice la base de datos.");
      }
      throw new Error(errorMessage)
    }
  },

  async list() {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to list Evaluaciones")

    try {
      const txAny = prisma as any
      // Modelo: EvaluacionEstudiante -> Propiedad: evaluacionEstudiante
      return await txAny.evaluacionEstudiante.findMany({
        orderBy: { fecha_creacion: 'desc' },
        include: {
          estudiantes: {
            include: {
              personas: {
                select: { nombre: true, primer_apellido: true, dni: true }
              },
              salas: { select: { nombre: true, grado: true } }
            }
          },
          profesores: {
            include: {
              personas: {
                select: { nombre: true, primer_apellido: true }
              }
            }
          },
          tipos_evaluacion: { select: { descripcion: true } },
          estados_evaluacion: { select: { descripcion: true } },
        },
      })
    } catch (error) {
      console.error("Error en listEvaluaciones:", error)
      throw new Error("Error al obtener la lista de evaluaciones.")
    }
  },

  async getById(id: string) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to get Evaluacion by ID")

    try {
      const txAny = prisma as any
      // Modelo: EvaluacionEstudiante -> Propiedad: evaluacionEstudiante
      return await txAny.evaluacionEstudiante.findUnique({
        where: { id },
        include: {
          estudiantes: {
            include: {
              personas: {
                select: { nombre: true, primer_apellido: true, segundo_apellido: true, dni: true, fecha_nacimiento: true }
              },
              salas: { select: { nombre: true, grado: true } },
              generos: { select: { descripcion: true } },
            }
          },
          profesores: {
            include: {
              personas: {
                select: { nombre: true, primer_apellido: true }
              }
            }
          },
          tipos_evaluacion: { select: { descripcion: true } },
          estados_evaluacion: { select: { descripcion: true } },
          // Modelo: EvaluacionesEstudianteArea (pluralizada en la relación) -> evaluacion_estudiante_area
          // OJO: Aquí depende de cómo se llame la relación en tu schema.prisma dentro del modelo EvaluacionEstudiante.
          // En tu schema dice: evaluaciones_estudiante_area EvaluacionesEstudianteArea[]
          // Por tanto, aquí sí se usa el nombre de la relación definida en el schema.
          evaluaciones_estudiante_area: {
            include: {
              areas: { select: { nombre: true, descripcion: true } },
              estados_evaluacion: { select: { descripcion: true } },
            },
            orderBy: { areas: { orden: 'asc' } }
          }
        },
      })
    } catch (error) {
      console.error("Error en getEvaluacionById:", error)
      throw new Error("Error al obtener el detalle de la evaluación.")
    }
  },

  async delete(id: string) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to delete Evaluacion")

    try {
      return await prisma.$transaction(async (tx) => {
        const txAny = tx as any

        // 1. Verificar si existe
        const exists = await txAny.evaluacionEstudiante.findUnique({
          where: { id }
        })
        if (!exists) {
          throw new Error("La evaluación no existe")
        }

        // 2. Eliminar las áreas asociadas primero (por restricción de clave foránea)
        // Modelo: EvaluacionesEstudianteArea
        await txAny.evaluacionesEstudianteArea.deleteMany({
          where: {
            evaluacion_estudiante_id: id
          }
        })

        // 3. Eliminar la evaluación principal
        // Modelo: EvaluacionEstudiante
        const deleted = await txAny.evaluacionEstudiante.delete({
          where: { id }
        })

        return deleted
      })
    } catch (error) {
      console.error("Error en deleteEvaluacion:", error)
      const msg = error instanceof Error ? error.message : "Error al eliminar evaluación"
      throw new Error(msg)
    }
  },
}