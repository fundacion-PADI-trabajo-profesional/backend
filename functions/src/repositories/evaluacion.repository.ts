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

async function calculateAreaScore(tx: any, evaluacionAreaId: string, salaId: number, areaId: string): Promise<{
  puntajeFinal: number,
  completado: boolean,
  totalPuntosPosibles: number,
  estadoFinalArea: string,
  aciertosIndividuales: number,
  totalPreguntasActivas: number
}> {
  const ESTADO_APROBADA = 'A';
  const ESTADO_DESAPROBADA = 'D';
  const ESTADO_EN_PROGRESO_ID = 'E';
  const ESTADO_COMPLETADA_ID = 'C';

  // 1. Obtener preguntas y respuestas de esta área
  const questionsAndAnswers = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
    where: { evaluaciones_area_id: evaluacionAreaId },
    include: {
      preguntas: { select: { id: true, numero: true, puntaje: true, aprueba_con: true, activa: true } }
    }
  });

  const areaRule = await tx.reglasAprobacion.findFirst({
    where: { sala_id: salaId, area_id: areaId }
  });

  // 2. Contar el total de preguntas activas
  const totalPreguntasActivas = await tx.preguntas.count({
    where: { sala_id: salaId, area_id: areaId, activa: true }
  });

  let questionsAnswered = 0;
  let totalScore = 0; // Puntaje basado en grupos (regla de aprobación)
  let aciertosIndividuales = 0;
  const answeredGroups: Record<number, { count: number, apruebaCon: number, pointValue: number }> = {};

  // 3. Recorrer y contar aciertos individuales y por grupo
  for (const qa of questionsAndAnswers) {
    if (qa.respuesta !== null) {
      questionsAnswered++;
    }

    const qNumber = qa.preguntas.numero;
    const qApruebaCon = parseInt(qa.preguntas.aprueba_con?.split('/')[0] || '1');

    if (qNumber !== null) {
      if (!answeredGroups[qNumber]) {
        answeredGroups[qNumber] = {
          count: 0,
          apruebaCon: qApruebaCon,
          pointValue: qa.preguntas.puntaje || 1
        };
      }

      // CORRECCIÓN DE ACERTOS INDIVIDUALES
      if (qa.respuesta === 1) { // Cuenta si la respuesta es "Sí"
        answeredGroups[qNumber].count++;
        aciertosIndividuales++; // <--- VALOR CORRECTO
      }
    }
  }

  // 4. Calcular PUNTAJE FINAL (Suma de grupos pasados)
  for (const qNumberStr in answeredGroups) {
    const group = answeredGroups[qNumberStr];

    if (group.count >= group.apruebaCon) {
      totalScore += group.pointValue;
    }
  }

  // 5. Determinar el estado final del área (lógica de aprobación)
  const completado = questionsAnswered === totalPreguntasActivas;
  let estadoFinalArea = ESTADO_EN_PROGRESO_ID;

  const totalMaxScore = areaRule?.puntaje_total || 0;
  const requiredScoreToPass = areaRule?.aprueba_con || 0;

  if (completado) {
    estadoFinalArea = totalScore >= requiredScoreToPass ? ESTADO_APROBADA : ESTADO_DESAPROBADA;
  } else if (questionsAnswered > 0) {
    estadoFinalArea = ESTADO_EN_PROGRESO_ID;
  }

  return {
    puntajeFinal: totalScore,
    completado: completado,
    totalPuntosPosibles: totalMaxScore,
    estadoFinalArea: estadoFinalArea,
    aciertosIndividuales: aciertosIndividuales,
    totalPreguntasActivas: totalPreguntasActivas
  };
}

async function checkOverallApproval(tx: any, evaluacionId: string, salaId: number) {
  // ... (Lógica de aprobación general sigue igual, ya que usa los puntajes finales de las áreas)
  const currentScores = await tx.evaluacionesEstudianteArea.findMany({
    where: { evaluacion_estudiante_id: evaluacionId },
    select: { area_id: true, puntaje: true }
  });

  const approvalRules = await tx.reglasAprobacion.findMany({
    where: { sala_id: salaId },
    select: { area_id: true, aprueba_con: true, puntaje_total: true }
  });

  const totalAreas = 4; // Asumimos 4 áreas

  if (approvalRules.length === totalAreas) {
    let totalPuntosObtenidos = 0;
    let totalPuntosPosibles = 0;

    for (const rule of approvalRules) {
      const score = currentScores.find((s: { area_id: string; puntaje: number }) => s.area_id === rule.area_id)?.puntaje || 0;

      totalPuntosObtenidos += score;
      totalPuntosPosibles += rule.puntaje_total || 0;
    }

    const overallApprovalPercentage = (totalPuntosObtenidos / totalPuntosPosibles) * 100;

    if (overallApprovalPercentage >= 70) {
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
    // Si el ID no tiene pinta de UUID, devolvemos null directamente
    // para que la capa de servicio responda 404 en lugar de reventar Prisma.
    const basicUuidRegex = /^[0-9a-fA-F-]{36}$/
    if (!basicUuidRegex.test(id)) {
      return null
    }

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
          evaluaciones_estudiante_area: {
            include: {
              areas: { select: { nombre: true, descripcion: true } },
              estados_evaluacion: { select: { descripcion: true } },
              evaluaciones_estudiante: {
                select: { sala_id: true }
              }
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

        // 2. Obtener los IDs de las áreas asociadas (necesarios para eliminar las preguntas)
        const areas = await txAny.evaluacionesEstudianteArea.findMany({
          where: { evaluacion_estudiante_id: id },
          select: { id: true }
        });
        const areaIds = areas.map((a: { id: string }) => a.id);

        // 3. Eliminar todas las respuestas asociadas a estas áreas.
        // Tabla: EvaluacionesEstudianteAreaPreguntas
        if (areaIds.length > 0) {
          await txAny.evaluacionesEstudianteAreaPreguntas.deleteMany({
            where: {
              evaluaciones_area_id: { in: areaIds }
            }
          })
        }

        // 4. Eliminar las áreas asociadas (por restricción de clave foránea)
        // Tabla: EvaluacionesEstudianteArea
        await txAny.evaluacionesEstudianteArea.deleteMany({
          where: {
            evaluacion_estudiante_id: id
          }
        })

        // 5. Eliminar la evaluación principal
        // Tabla: EvaluacionEstudiante
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
      // CORRECCIÓN 1: Ordenar por número y luego por ID para consistencia
      orderBy: [{ numero: 'asc' }, { id: 'asc' }]
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

  async saveRespuestas(payload: { evaluacionId: string, areaId: string, preguntas: { id: string, answer: number | null }[] }) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to saveRespuestas")

    const ESTADO_COMPLETADA_ID = 'C'
    const ESTADO_EN_PROGRESO_ID = 'E'
    const TRANSACTION_TIMEOUT_MS = 10000;

    try {
      return await prisma.$transaction(async (tx) => {
        const txAny = tx as any
        const { evaluacionId, areaId, preguntas } = payload

        // A. Verificar existencia de evaluación y obtener sala_id
        const evaluacionMain = await txAny.evaluacionEstudiante.findUnique({
          where: { id: evaluacionId }
        })
        if (!evaluacionMain) throw new Error("Evaluación principal no encontrada.")

        // B. Obtener el EvaluacionesEstudianteArea id
        const evaluacionArea = await txAny.evaluacionesEstudianteArea.findFirst({
          where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId }
        })
        if (!evaluacionArea) throw new Error("Área de evaluación no encontrada.")

        // C. Actualizar o crear respuestas
        for (const q of preguntas) {
          // Solo actualizamos si la respuesta no es nula
          if (q.answer !== null) {
            await txAny.evaluacionesEstudianteAreaPreguntas.upsert({
              where: {
                // Clave compuesta o única que usaste para pregunta_id y evaluaciones_area_id
                evaluaciones_area_id_pregunta_id: {
                  evaluaciones_area_id: evaluacionArea.id,
                  pregunta_id: q.id,
                }
              },
              update: {
                respuesta: q.answer,
                fecha_actualizacion: new Date()
              },
              create: {
                evaluaciones_area_id: evaluacionArea.id,
                pregunta_id: q.id,
                respuesta: q.answer,
              }
            })
          }
        }

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
            estado_id: scoreResult.estadoFinalArea, // Usamos el estado A/D/C/E calculado
            puntaje: scoreResult.puntajeFinal,
          }
        })

        // G. Verificar Aprobación General
        if (nuevoEstado === ESTADO_COMPLETADA_ID) {
          const allAreas = await txAny.evaluacionesEstudianteArea.findMany({
            where: { evaluacion_estudiante_id: evaluacionId }
          });

          const allCompleted = allAreas.every((area: any) => area.estado_id === ESTADO_COMPLETADA_ID);

          if (allCompleted) {
            // asumiendo que checkOverallApproval existe y funciona
            // await checkOverallApproval(txAny, evaluacionId, evaluacionMain!.sala_id); 
          }
        }

        // Devolvemos la información necesaria para que el frontend actualice el progreso
        return {
          success: true,
          estado: nuevoEstado,
          puntaje: scoreResult.puntajeFinal,
          aciertosIndividuales: scoreResult.aciertosIndividuales, // <--- CORRECTO PARA ESTADO INMEDIATO
          totalPreguntas: scoreResult.totalPreguntasActivas
        }
      }, { timeout: TRANSACTION_TIMEOUT_MS })
    } catch (error) {
      console.error("Error en saveRespuestas:", error)
      const msg = error instanceof Error ? error.message : "Error al guardar respuestas"
      throw new Error(msg)
    }
  },

  async getTotalActiveQuestionsBySalaAndArea(salaId: number, areaId: string): Promise<number> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to fetch total questions");

    const count = await (prisma as any).preguntas.count({
      where: {
        sala_id: salaId,
        area_id: areaId,
        activa: true,
      },
    });

    return count;
  },

  async getAreaScoreDetails(evaluacionAreaId: string, salaId: number, areaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to calculate score details");

    // Llamamos a la lógica de cálculo
    return await calculateAreaScore(prisma, evaluacionAreaId, salaId, areaId);
  },

  async getReglasAprobacionBySala(salaId: number) {
    const prisma = getPrisma()
    if (!prisma) throw new Error("DB not available to fetch Reglas")

    return await (prisma as any).reglasAprobacion.findMany({
      where: { sala_id: salaId },
      select: { area_id: true, aprueba_con: true, puntaje_total: true }
    })
  },
}