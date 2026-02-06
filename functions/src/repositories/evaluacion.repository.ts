import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/prismaClient";

const ESTADO_NO_INICIADA = "N";
const ESTADO_EN_PROGRESO = "E";
const ESTADO_APROBADA = "A";
const ESTADO_DESAPROBADA = "D";

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

  //PREGUNTAS AREAS
  async getPreguntasArea(evaluacionId: string, areaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const txAny = prisma as any;

    //get sala de la evaluación
    const evalEst = await txAny.evaluacionEstudiante.findUnique({
      where: { id: evaluacionId },
      select: { id: true, sala_id: true },
    });
    if (!evalEst) throw new Error("Evaluación no encontrada");

    // 2) registro intermedio area
    const evalArea = await txAny.evaluacionesEstudianteArea.findFirst({
      where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId },
      select: { id: true },
    });
    if (!evalArea) throw new Error("Área no encontrada para esta evaluación");

    //preguntas 
    const preguntas = await txAny.preguntas.findMany({
      where: {
        sala_id: evalEst.sala_id,
        area_id: areaId,
        OR: [{ activa: true }, { activa: null }],
      },
      orderBy: [{ numero: "asc" }, { id: "asc" }],
    });

    console.log(
      "[getPreguntasArea] preguntas:",
      preguntas.length,
      "evaluacionId:",
      evaluacionId,
      "areaId:",
      areaId,
      "sala:",
      evalEst.sala_id
    );

    // 4) respuestas previas
    const respuestas = await txAny.evaluacionesEstudianteAreaPreguntas.findMany({
      where: { evaluaciones_area_id: evalArea.id },
      select: { pregunta_id: true, respuesta: true },
    });

    return { preguntas, respuestas };
  },

  async saveRespuestas(
    evaluacionId: string,
    areaId: string,
    questions: { id: string; answer: number | null }[]
  ) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    return await prisma.$transaction(async (tx) => {
      const txAny = tx as any;

      const evalEst = await txAny.evaluacionEstudiante.findUnique({
        where: { id: evaluacionId },
        select: { id: true, sala_id: true },
      });
      if (!evalEst) throw new Error("Evaluación no encontrada");

      const evalArea = await txAny.evaluacionesEstudianteArea.findFirst({
        where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId },
        select: { id: true },
      });
      if (!evalArea) throw new Error("Área no encontrada para esta evaluación");

      // 1) Upsert manual (el schema NO tiene @@unique compuesto, asi que hacemos findFirst + update/create)
      for (const q of questions) {
        const existing = await txAny.evaluacionesEstudianteAreaPreguntas.findFirst({
          where: {
            evaluaciones_area_id: evalArea.id,
            pregunta_id: q.id,
          },
          select: { id: true },
        });

        if (existing) {
          await txAny.evaluacionesEstudianteAreaPreguntas.update({
            where: { id: existing.id },
            data: {
              respuesta: q.answer,
              fecha_actualizacion: new Date(),
            },
          });
        } else {
          await txAny.evaluacionesEstudianteAreaPreguntas.create({
            data: {
              evaluaciones_area_id: evalArea.id,
              pregunta_id: q.id,
              respuesta: q.answer,
              fecha_actualizacion: new Date(),
            },
          });
        }
      }

      const scoreResult = await calculateAreaScore(
        txAny,
        evalArea.id,
        evalEst.sala_id,
        areaId
      );

      //estado y puntaje correctos
      await txAny.evaluacionesEstudianteArea.update({
        where: { id: evalArea.id },
        data: {
          estado_id: scoreResult.estadoFinalArea, // E / A / D
          puntaje: scoreResult.puntajeFinal,
        },
      });

      //util para el front
      return {
        estado: scoreResult.estadoFinalArea,
        puntaje: scoreResult.puntajeFinal,
        aciertosIndividuales: scoreResult.aciertosIndividuales, // grupos aprobados
        totalPreguntas: scoreResult.totalPreguntasActivas       // total grupos
      };
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

async function calculateAreaScore(
  tx: any,
  evaluacionAreaId: string,
  salaId: number,
  areaId: string
): Promise<{
  puntajeFinal: number,
  completado: boolean,
  totalPuntosPosibles: number,
  estadoFinalArea: string,
  aciertosIndividuales: number, //grupos aprobados
  totalPreguntasActivas: number//total de grupos
}> {
  const ESTADO_EN_PROGRESO = "E";
  const ESTADO_APROBADA = "A";
  const ESTADO_DESAPROBADA = "D";

  //Traer todas las respuestas del área con su pregunta (incluye numero = grupo)
  const qas = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
    where: { evaluaciones_area_id: evaluacionAreaId },
    include: {
      preguntas: { select: { id: true, numero: true, activa: true } }
    }
  });

  //Filtrar preguntas activas (si activa es null la tomamos como activa)
  const activos = qas.filter((qa: any) => qa.preguntas && (qa.preguntas.activa === true || qa.preguntas.activa === null));

  // Si no hay nada, no penalizamos: queda no iniciada (pero tu flujo suele pre-poblar)
  if (activos.length === 0) {
    return {
      puntajeFinal: 0,
      completado: false,
      totalPuntosPosibles: 0,
      estadoFinalArea: ESTADO_EN_PROGRESO,
      aciertosIndividuales: 0,
      totalPreguntasActivas: 0
    };
  }

  //agrupar por "numero" (grupo). Si numero es null, lo tratamos como grupo unico por pregunta
  type GroupStats = { total: number; answered: number; correct: number };
  const groups = new Map<number | string, GroupStats>();

  for (const qa of activos) {
    const groupKey = qa.preguntas.numero ?? `Q:${qa.pregunta_id}`;
    const g = groups.get(groupKey) ?? { total: 0, answered: 0, correct: 0 };

    g.total += 1;

    if (qa.respuesta !== null && qa.respuesta !== undefined) {
      g.answered += 1;
      if (qa.respuesta === 1) g.correct += 1;
    }

    groups.set(groupKey, g);
  }

  const totalGrupos = groups.size;

  //Grupo aprobado si correctas >= ceil(total/2)  (50% o +)
  let gruposAprobados = 0;
  let completado = true;

  for (const [, g] of groups) {
    if (g.answered < g.total) completado = false;

    const needed = Math.ceil(g.total / 2);
    if (g.correct >= needed) gruposAprobados += 1;
  }

  //Regla del area: cuántos grupos deben aprobarse para aprobar el área (tabla reglas_aprobacion)
  const areaRule = await tx.reglasAprobacion.findFirst({
    where: { sala_id: salaId, area_id: areaId },
    select: { aprueba_con: true, puntaje_total: true }
  });

  const totalPuntosPosibles = areaRule?.puntaje_total ?? totalGrupos;
  const requiredToPass = areaRule?.aprueba_con ?? Math.ceil(totalGrupos * 0.6); // fallback

  //Estado final del area
  let estadoFinalArea = ESTADO_EN_PROGRESO;
  if (completado) {
    estadoFinalArea = gruposAprobados >= requiredToPass ? ESTADO_APROBADA : ESTADO_DESAPROBADA;
  } else if (Array.from(groups.values()).some(g => g.answered > 0)) {
    estadoFinalArea = ESTADO_EN_PROGRESO;
  }

  return {
    puntajeFinal: gruposAprobados, //puntaje = grupos aprobados
    completado,
    totalPuntosPosibles,
    estadoFinalArea,
    aciertosIndividuales: gruposAprobados,
    totalPreguntasActivas: totalGrupos  //Total de grupos
  };
}