// Archivo: evaluacion.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"
import {
  CreateEvaluacionData,
  EVALUACION_AREAS,
  ESTADO_NO_INICIADA_ID,
} from "../interfaces/evaluacion.interface"

const TRANSACTION_TIMEOUT_MS = 10000;
const ESTADO_EN_PROGRESO_ID = 'E'
const ESTADO_COMPLETADA_ID = 'C'
const ESTADO_APROBADA_ID = 'A'

async function calculateAreaScore(tx: any, evaluacionAreaId: string, salaId: number, areaId: string): Promise<{ puntajeFinal: number, completado: boolean, totalPuntosPosibles: number }> {
  // 1. Obtener todas las preguntas y respuestas para el área
  const questionsAndAnswers = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
    where: { evaluaciones_area_id: evaluacionAreaId },
    include: {
      preguntas: { select: { id: true, numero: true, puntaje: true, aprueba_con: true, activa: true } }
    }
  });

  // 2. Obtener la regla de aprobación del área (ej: 5/6)
  const areaRule = await tx.reglasAprobacion.findFirst({
    where: { sala_id: salaId, area_id: areaId }
  });

  // 3. Obtener el total de preguntas (para la bandera 'completado')
  const totalPreguntasActivas = await tx.preguntas.count({
    where: { sala_id: salaId, area_id: areaId, activa: true }
  });

  // 4. Calcular PUNTAJE OBTENIDO (Agrupando por numero de pregunta)
  let totalScore = 0;
  let questionsAnswered = 0;
  const answeredGroups: Record<number, { count: number, maxCount: number, apruebaCon: number }> = {};
  const processedQuestionNumbers = new Set<number>();

  for (const qa of questionsAndAnswers) {
    if (qa.respuesta !== null) {
      questionsAnswered++;
    }

    const qNumber = qa.preguntas.numero;
    const qPuntaje = qa.preguntas.puntaje || 0;
    const qApruebaCon = parseInt(qa.preguntas.aprueba_con || '1'); // Target requerido

    if (qNumber !== null) {
      if (!answeredGroups[qNumber]) {
        // El total de partes es el número de filas en la DB, lo obtenemos al final.
        answeredGroups[qNumber] = { count: 0, maxCount: 0, apruebaCon: qApruebaCon };
      }
      if (qa.respuesta === 1) { // Asumimos 1=Sí (Respuesta Positiva)
        answeredGroups[qNumber].count++;
      }
    }
  }

  // Contar total de sub-preguntas (el denominador para los grupos)
  const totalSubQuestionsByNumber = await tx.preguntas.groupBy({
    by: ['numero'],
    where: { sala_id: salaId, area_id: areaId, activa: true },
    _count: { numero: true }
  });

  // Mapear los máximos y calcular el score final
  let currentQuestionNumber = 0;
  let totalPuntosPosibles = 0;

  for (const qa of questionsAndAnswers) {
    if (qa.preguntas.numero !== currentQuestionNumber) {
      // Es una nueva pregunta/grupo, verificamos la anterior.
      if (currentQuestionNumber !== 0 && !processedQuestionNumbers.has(currentQuestionNumber)) {
        // Verificar si el grupo anterior pasó el umbral y sumar el punto
        const group = answeredGroups[currentQuestionNumber];
        const maxCount = totalSubQuestionsByNumber.find((g: any) => g.numero === currentQuestionNumber)?._count.numero || 1;

        // Si el umbral requerido (apruebaCon) se cumple
        if (group.count >= group.apruebaCon) {
          totalScore += qa.preguntas.puntaje || 0;
        }
        totalPuntosPosibles += qa.preguntas.puntaje || 0;
        processedQuestionNumbers.add(currentQuestionNumber);
      }
      currentQuestionNumber = qa.preguntas.numero!;
    }
  }

  // Asegurar que la última pregunta/grupo se procese
  if (currentQuestionNumber !== 0 && !processedQuestionNumbers.has(currentQuestionNumber)) {
    const group = answeredGroups[currentQuestionNumber];
    const maxCount = totalSubQuestionsByNumber.find((g: any) => g.numero === currentQuestionNumber)?._count.numero || 1;

    if (group && group.count >= group.apruebaCon) {
      totalScore += questionsAndAnswers.find((q: any) => q.preguntas.numero === currentQuestionNumber)?.preguntas.puntaje || 0;
    }
    totalPuntosPosibles += questionsAndAnswers.find((q: any) => q.preguntas.numero === currentQuestionNumber)?.preguntas.puntaje || 0;
  }

  const completado = questionsAnswered === totalPreguntasActivas;

  return {
    puntajeFinal: totalScore,
    completado: completado,
    totalPuntosPosibles: areaRule?.puntaje_total || totalPuntosPosibles,
  };
}

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

  async checkOverallApproval(tx: any, evaluacionId: string, salaId: number) {
    // 1. Obtener todas las reglas de aprobación (puntaje_total y aprueba_con)
    const totalAreas = await tx.areas.count(); // Debería ser 4

    // 2. Obtener puntajes actuales de la evaluación
    const currentScores = await tx.evaluacionesEstudianteArea.findMany({
      where: { evaluacion_estudiante_id: evaluacionId },
      select: { area_id: true, puntaje: true }
    });

    // 3. Obtener todas las reglas de aprobación para esta sala
    const approvalRules = await tx.reglasAprobacion.findMany({
      where: { sala_id: salaId },
      select: { area_id: true, aprueba_con: true, puntaje_total: true }
    });

    if (approvalRules.length === totalAreas) {
      let totalPuntosObtenidos = 0;
      let totalPuntosPosibles = 0;
      let areasAprobadasCount = 0;

      for (const rule of approvalRules) {
        const score = currentScores.find((s: { area_id: string; puntaje: number | null }) => s.area_id === rule.area_id)?.puntaje || 0;

        totalPuntosObtenidos += score;
        totalPuntosPosibles += rule.puntaje_total || 0;

        // Criterio de aprobación del área (por puntos)
        if (score >= (rule.aprueba_con || 0)) {
          areasAprobadasCount++;
        }
      }

      // Criterio de aprobación de la evaluación general: 
      // Criterio simple: si el 70% de las áreas se aprueban individualmente
      // Criterio complejo: si el puntaje total >= 70% del total posible.

      const overallApprovalPercentage = (totalPuntosObtenidos / totalPuntosPosibles) * 100;

      if (overallApprovalPercentage >= 70) { // Usamos 70% como criterio estándar
        await tx.evaluacionEstudiante.update({
          where: { id: evaluacionId },
          data: { estado_id: ESTADO_APROBADA_ID, puntaje: overallApprovalPercentage }
        })
      } else {
        await tx.evaluacionEstudiante.update({
          where: { id: evaluacionId },
          data: { estado_id: 'D', puntaje: overallApprovalPercentage } // Desaprobada
        })
      }
    }
  },

  async getPreguntasByEvaluacionAndArea(evaluacionId: string, areaId: string) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available")

    // 1. Obtener la sala de la evaluación
    const evaluacion = await (prisma as any).evaluacionEstudiante.findUnique({
      where: { id: evaluacionId },
      select: { sala_id: true }
    })

    if (!evaluacion) throw new Error("Evaluación no encontrada")

    // 2. Buscamos las preguntas asociadas a esa sala y área
    const preguntas = await (prisma as any).preguntas.findMany({
      where: {
        sala_id: evaluacion.sala_id,
        area_id: areaId,
        activa: true
      },
      orderBy: { numero: 'asc' }
    })

    // 3. Buscamos el registro intermedio de área
    const evaluacionArea = await (prisma as any).evaluacionesEstudianteArea.findFirst({
      where: {
        evaluacion_estudiante_id: evaluacionId,
        area_id: areaId
      },
      select: { id: true }
    })

    let respuestasPrevias: any[] = []

    if (evaluacionArea) {
      respuestasPrevias = await (prisma as any).evaluacionesEstudianteAreaPreguntas.findMany({
        where: {
          evaluaciones_area_id: evaluacionArea.id
        }
      })
    }

    return {
      preguntas,
      respuestas: respuestasPrevias,
      evaluacionAreaId: evaluacionArea?.id
    }
  },

  async saveRespuestas(payload: { evaluacionId: string, areaId: string, preguntas: { id: string, answer: number }[] }) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available")

    const { evaluacionId, areaId, preguntas } = payload

    return await prisma.$transaction(async (tx) => {
      const txAny = tx as any

      // A. Buscar el registro intermedio EvaluacionesEstudianteArea
      const evaluacionArea = await txAny.evaluacionesEstudianteArea.findFirst({
        where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId }
      })

      if (!evaluacionArea) throw new Error("El área de evaluación no existe para este estudiante")

      // B. Guardar/Actualizar cada respuesta
      for (const p of preguntas) {
        // Usamos Upsert: Si ya existe la respuesta (pregunta_id), la actualizamos, si no, la creamos.
        // NOTA: Usar un campo único compuesto aquí sería ideal, pero nos apegaremos al esquema actual.

        const existingAnswer = await txAny.evaluacionesEstudianteAreaPreguntas.findFirst({
          where: {
            evaluaciones_area_id: evaluacionArea.id,
            pregunta_id: p.id
          }
        })

        if (existingAnswer) {
          await txAny.evaluacionesEstudianteAreaPreguntas.update({
            where: { id: existingAnswer.id },
            data: { respuesta: p.answer, fecha_actualizacion: new Date() }
          })
        } else {
          // Esto no debería suceder si la pre-población funcionó
          await txAny.evaluacionesEstudianteAreaPreguntas.create({
            data: { evaluaciones_area_id: evaluacionArea.id, pregunta_id: p.id, respuesta: p.answer }
          })
        }
      }

      // C. Obtener Sala del estudiante
      const evaluacionMain = await txAny.evaluacionEstudiante.findUnique({
        where: { id: evaluacionId },
        select: { sala_id: true, estudiante_id: true }
      })

      // D. Calcular Estado y Puntaje del Área
      const scoreResult = await calculateAreaScore(txAny, evaluacionArea.id, evaluacionMain!.sala_id, areaId);

      // E. Determinar ESTADO
      let nuevoEstado = ESTADO_EN_PROGRESO_ID;
      if (scoreResult.completado) {
        nuevoEstado = ESTADO_COMPLETADA_ID;
      }

      // F. Actualizar el registro del Área
      await txAny.evaluacionesEstudianteArea.update({
        where: { id: evaluacionArea.id },
        data: {
          estado_id: nuevoEstado,
          puntaje: scoreResult.puntajeFinal,
        }
      })

      // G. Verificar Aprobación General
      // Esta es una verificación de ALTO COSTO. Solo correr cuando TODAS las áreas estén completas.
      if (nuevoEstado === ESTADO_COMPLETADA_ID) {
        const allAreas = await txAny.evaluacionesEstudianteArea.findMany({
          where: { evaluacion_estudiante_id: evaluacionId }
        });

        const allCompleted = allAreas.every((area: any) => area.estado_id === ESTADO_COMPLETADA_ID);

        if (allCompleted) {
          await EvaluacionRepository.checkOverallApproval(txAny, evaluacionId, evaluacionMain!.sala_id);
        }
      }
      return { success: true, estado: nuevoEstado, puntaje: scoreResult.puntajeFinal }
    })
  },


}