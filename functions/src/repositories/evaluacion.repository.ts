// Archivo: evaluacion.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"
import {
  CreateEvaluacionData,
  EVALUACION_AREAS,
  ESTADO_NO_INICIADA_ID,
} from "../interfaces/evaluacion.interface"

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
    const { dni, tipo_id, profesor_id } = data

    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to create Evaluacion")

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Tipamos tx como 'any' para evitar conflictos de tipos, 
        // pero usamos los nombres camelCase correctos de los modelos.
        const txAny = tx as any

        // 1. Encontrar el estudiante
        // Modelo: Estudiantes -> Propiedad: estudiantes
        const estudiante = await txAny.estudiantes.findFirst({
          where: {
            personas: {
              dni: dni,
            },
          },
          select: {
            id: true,
            sala_id: true,
          },
        })

        if (!estudiante) {
          throw new Error(`Estudiante con DNI ${dni} no encontrado.`)
        }

        // 2. Crear la evaluación principal
        // Modelo: EvaluacionEstudiante -> Propiedad: evaluacionEstudiante
        // (Nota: Prisma suele usar camelCase del nombre del modelo)
        const nuevaEvaluacion = await txAny.evaluacionEstudiante.create({
          data: {
            estudiante_id: estudiante.id,
            profesor_id: profesor_id,
            sala_id: estudiante.sala_id,
            tipo_id: tipo_id,
            estado_id: ESTADO_NO_INICIADA_ID,
          },
        })

        // 3. Crear las 4 entradas en evaluaciones_estudiante_area
        const areasToCreate = EVALUACION_AREAS.map((area) => ({
          evaluacion_estudiante_id: nuevaEvaluacion.id,
          area_id: area.id,
          estado_id: ESTADO_NO_INICIADA_ID,
        }))

        // Modelo: EvaluacionesEstudianteArea -> Propiedad: evaluacionesEstudianteArea
        await txAny.evaluacionesEstudianteArea.createMany({
          data: areasToCreate,
        })

        // 4. Devolver la evaluación creada
        const areasCreadas = await txAny.evaluacionesEstudianteArea.findMany({
          where: {
            evaluacion_estudiante_id: nuevaEvaluacion.id,
          },
          include: {
            areas: { select: { nombre: true } },
            estados_evaluacion: { select: { descripcion: true } },
          },
        })

        return {
          ...nuevaEvaluacion,
          areas: areasCreadas,
        }
      })

      return result
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new Error("El tipo de evaluación o profesor no existe.")
        }
      }
      // Logueamos el error completo para debug en backend
      console.error("Error en transacción createEvaluacion (Backend):", error)
      const errorMessage = error instanceof Error ? error.message : "Error al crear la evaluación."
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
  }
}