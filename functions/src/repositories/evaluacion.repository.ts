import { withRLSContext } from "../config/prismaClient";

/** Estado: no iniciada. */
const ESTADO_NO_INICIADA = "N";
/** Estado: en progreso (al menos un área respondida). */
const ESTADO_EN_PROGRESO = "E";
/** Estado: aprobada (todas las áreas aprobadas). */
const ESTADO_APROBADA = "A";
/** Estado: desaprobada (todas las áreas completadas pero alguna desaprobada). */
const ESTADO_DESAPROBADA = "D";

/**
 * Repositorio de acceso a datos para evaluaciones de estudiantes.
 */
export const EvaluacionRepository = {
  /**
   * Busca un estudiante por su DNI y retorna su ID y sala.
   */
  async findEstudianteByDni(dni: string) {
    return withRLSContext(async (tx) => {
      return tx.estudiantes.findFirst({
        where: { personas: { dni }, fecha_baja: null },
        select: { id: true, sala_id: true },
      });
    });
  },

  /**
   * Crea una evaluación y genera automáticamente los registros de área.
   */
  async create(data: {
    estudiante_id: string;
    profesor_id: string;
    sala_id: number;
    aula_id?: string;
    tipo_id: string;
    fecha_creacion: Date;
  }) {
    return withRLSContext(async (tx) => {
      const evaluacion = await tx.evaluacionEstudiante.create({
        data: {
          estudiante_id: data.estudiante_id,
          profesor_id: data.profesor_id,
          sala_id: data.sala_id,
          aula_id: data.aula_id ?? null,
          tipo_id: data.tipo_id,
          estado_id: ESTADO_NO_INICIADA,
          fecha_creacion: data.fecha_creacion,
        },
      });

      const todasLasAreas = await tx.areas.findMany({
        orderBy: { orden: "asc" },
      });

      const areasData = todasLasAreas.map((area: any) => ({
        evaluacion_estudiante_id: evaluacion.id,
        area_id: area.id,
        estado_id: ESTADO_NO_INICIADA,
        puntaje: 0,
      }));

      await tx.evaluacionesEstudianteArea.createMany({
        data: areasData,
      });

      return evaluacion;
    });
  },

  /**
   * Lista todas las evaluaciones asignadas a un docente.
   */
  async findAllByProfesor(profesor_id: string) {
    return withRLSContext(async (tx) => {
      return tx.evaluacionEstudiante.findMany({
        where: { profesor_id },
        include: {
          aulas: {
            select: { id: true, comision: true, turno: true },
          },
          estudiantes: {
            include: {
              personas: { select: { nombre: true, primer_apellido: true } },
              escuela: { select: { nombre: true } },
              salas: { select: { nombre: true } },
            },
          },
          tipos_evaluacion: { select: { descripcion: true } },
          estados_evaluacion: { select: { descripcion: true } },
        },
        orderBy: { fecha_creacion: "desc" },
      });
    });
  },

  /**
   * Lista todas las evaluaciones del sistema (uso exclusivo del rol `admin`).
   */
  async list() {
    return withRLSContext(async (tx) => {
      return tx.evaluacionEstudiante.findMany({
        include: this._commonIncludes(),
        orderBy: { fecha_creacion: "desc" },
      });
    });
  },

  /**
   * Lista evaluaciones aplicando filtros opcionales con restricciones por rol.
   */
  async listWithFilters(filters?: {
    estudianteId?: string;
    profesorId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    escuelaId?: string;
    escuelaIds?: string[];
  }) {
    return withRLSContext(async (tx) => {
      const where: any = {};
      if (filters?.estudianteId) where.estudiante_id = filters.estudianteId;
      if (filters?.profesorId) where.profesor_id = filters.profesorId;
      if (filters?.salaId !== undefined) where.sala_id = filters.salaId;
      if (filters?.tipoId) where.tipo_id = filters.tipoId;
      if (filters?.estadoId) where.estado_id = filters.estadoId;
      if (filters?.escuelaId) {
        where.estudiantes = { escuela_id: filters.escuelaId };
      } else if (filters?.escuelaIds && filters.escuelaIds.length > 0) {
        where.estudiantes = { escuela_id: { in: filters.escuelaIds } };
      }

      return tx.evaluacionEstudiante.findMany({
        where,
        include: this._commonIncludes(),
        orderBy: { fecha_creacion: "desc" },
      });
    });
  },

  /**
   * Busca la asignación activa de un estudiante a un aula.
   */
  async findActiveEstudianteAula(estudianteId: string, aulaId: string) {
    return withRLSContext(async (tx) => {
      return tx.estudiantesAulas.findFirst({
        where: {
          estudiante_id: estudianteId,
          aula_id: aulaId,
          fecha_fin: null,
        },
        include: {
          aula: {
            select: {
              id: true,
              sala_id: true,
              escuela_id: true,
            },
          },
        },
      });
    });
  },

  /**
   * Lista evaluaciones filtradas por escuela (para directores y docentes).
   */
  async listByEscuela(escuelaId: string) {
    return withRLSContext(async (tx) => {
      return tx.evaluacionEstudiante.findMany({
        where: {
          estudiantes: { escuela_id: escuelaId },
        },
        include: this._commonIncludes(),
        orderBy: { fecha_creacion: "desc" },
      });
    });
  },

  /**
   * Retorna el detalle completo de una evaluación, incluyendo puntajes calculados por área.
   */
  async findById(id: string) {
    return withRLSContext(async (tx) => {

      const evaluacion = await tx.evaluacionEstudiante.findUnique({
        where: { id },
        include: {
          aulas: {
            select: { id: true, comision: true, turno: true, escuela_id: true },
          },
          estudiantes: {
            include: {
              personas: true,
              generos: { select: { descripcion: true } },
              salas: true,
              escuela: { select: { nombre: true } },
            },
          },
          evaluaciones_estudiante_area: {
            include: {
              areas: true,
              estados_evaluacion: true,
              evaluaciones_estudiante_area_preguntas: {
                include: {
                  preguntas: { select: { id: true, numero: true, activa: true, puntaje: true } },
                },
              },
            },
            orderBy: { areas: { orden: "asc" } },
          },
        },
      });

      if (!evaluacion) return null;

      // Enriquecemos cada área con aciertos/total por GRUPO
      for (const area of evaluacion.evaluaciones_estudiante_area) {
        const qas = area.evaluaciones_estudiante_area_preguntas || [];
        const activos = qas.filter((qa: any) => qa.preguntas && (qa.preguntas.activa === true || qa.preguntas.activa === null));

        type GroupStats = { total: number; correct: number; answered: number; puntajes: number[] };
        const groups = new Map<number | string, GroupStats>();

        for (const qa of activos) {
          const groupKey = qa.preguntas.numero ?? `Q:${qa.pregunta_id}`;
          const g = groups.get(groupKey) ?? { total: 0, correct: 0, answered: 0, puntajes: [] };

          g.total += 1;

          const p = qa.preguntas.puntaje;
          g.puntajes.push((p === null || p === undefined) ? 1 : Number(p));

          if (qa.respuesta !== null && qa.respuesta !== undefined) {
            g.answered += 1;
            if (qa.respuesta === 1) g.correct += 1;
          }

          groups.set(groupKey, g);
        }

        const totalGrupos = groups.size;
        let gruposAprobados = 0;
        let totalPuntosPosibles = 0;
        let puntajeFinal = 0;

        for (const [, g] of groups) {
          const needed = Math.ceil(g.total / 2);
          const apruebaGrupo = g.correct >= needed;

          const unique = Array.from(new Set(g.puntajes));
          const groupValue = unique.length === 1 ? unique[0] : Math.max(...unique);

          totalPuntosPosibles += groupValue;

          if (apruebaGrupo) {
            gruposAprobados += 1;
            puntajeFinal += groupValue;
          }
        }

        (area as any).aciertos_individuales = gruposAprobados;
        (area as any).totalPreguntas = totalGrupos;
        (area as any).totalPuntosPosibles = totalPuntosPosibles;
        (area as any).puntajeFinal = puntajeFinal;
        (area as any).gruposRespondidos = Array.from(groups.values()).filter(g => g.answered === g.total).length;
      }

      return evaluacion;
    });
  },

  /**
   * Elimina una evaluación y sus datos dependientes en una transacción.
   */
  async delete(id: string) {
    try {
      return await withRLSContext(async (tx) => {

        // 1) Verificar existencia
        const exists = await tx.evaluacionEstudiante.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) {
          throw new Error("La evaluación no existe");
        }

        // 2) Buscar áreas asociadas
        const areas = await tx.evaluacionesEstudianteArea.findMany({
          where: { evaluacion_estudiante_id: id },
          select: { id: true },
        });

        const areaIds = areas.map((a: { id: string }) => a.id);

        // 3) Borrar respuestas (hijas) primero
        if (areaIds.length > 0) {
          await tx.evaluacionesEstudianteAreaPreguntas.deleteMany({
            where: { evaluaciones_area_id: { in: areaIds } },
          });
        }

        // 4) Borrar áreas
        await tx.evaluacionesEstudianteArea.deleteMany({
          where: { evaluacion_estudiante_id: id },
        });

        // 5) Borrar evaluación principal
        return tx.evaluacionEstudiante.delete({
          where: { id },
        });
      });
    } catch (error: any) {
      console.error("Error en deleteEvaluacion:", error);
      throw new Error(error?.message || "Error al eliminar evaluación");
    }
  },

  /**
   * Retorna las preguntas activas de un área para una evaluación y las respuestas previas.
   */
  async getPreguntasArea(evaluacionId: string, areaId: string) {
    return withRLSContext(async (tx) => {

      const evalEst = await tx.evaluacionEstudiante.findUnique({
        where: { id: evaluacionId },
        select: { id: true, sala_id: true },
      });
      if (!evalEst) throw new Error("Evaluación no encontrada");

      const evalArea = await tx.evaluacionesEstudianteArea.findFirst({
        where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId },
        select: { id: true },
      });
      if (!evalArea) throw new Error("Área no encontrada para esta evaluación");

      const preguntas = await tx.preguntas.findMany({
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

      const respuestas = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
        where: { evaluaciones_area_id: evalArea.id },
        select: { pregunta_id: true, respuesta: true },
      });

      return { preguntas, respuestas };
    });
  },

  /**
   * Guarda (o actualiza) las respuestas de un área y recalcula su estado y puntaje.
   */
  async saveRespuestas(
    evaluacionId: string,
    areaId: string,
    questions: { id: string; answer: number | null }[]
  ) {
    return withRLSContext(async (tx) => {

      const evalEst = await tx.evaluacionEstudiante.findUnique({
        where: { id: evaluacionId },
        select: { id: true, sala_id: true, estudiante_id: true },
      });
      if (!evalEst) throw new Error("Evaluación no encontrada");

      const estudiante = await tx.estudiantes.findUnique({
        where: { id: evalEst.estudiante_id },
        select: { fecha_baja: true },
      });
      if (estudiante?.fecha_baja) throw new Error("No se pueden modificar evaluaciones de un estudiante dado de baja.");

      const evalArea = await tx.evaluacionesEstudianteArea.findFirst({
        where: { evaluacion_estudiante_id: evaluacionId, area_id: areaId },
        select: { id: true },
      });
      if (!evalArea) throw new Error("Área no encontrada para esta evaluación");

      // Upsert manual
      for (const q of questions) {
        const existing = await tx.evaluacionesEstudianteAreaPreguntas.findFirst({
          where: {
            evaluaciones_area_id: evalArea.id,
            pregunta_id: q.id,
          },
          select: { id: true },
        });

        if (existing) {
          await tx.evaluacionesEstudianteAreaPreguntas.update({
            where: { id: existing.id },
            data: {
              respuesta: q.answer,
              fecha_actualizacion: new Date(),
            },
          });
        } else {
          await tx.evaluacionesEstudianteAreaPreguntas.create({
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
        tx,
        evalArea.id,
        evalEst.sala_id,
        areaId
      );

      await tx.evaluacionesEstudianteArea.update({
        where: { id: evalArea.id },
        data: {
          estado_id: scoreResult.estadoFinalArea,
          puntaje: scoreResult.puntajeFinal,
        },
      });

      const areas = await tx.evaluacionesEstudianteArea.findMany({
        where: { evaluacion_estudiante_id: evaluacionId },
        select: { estado_id: true },
      });

      const areaEstados = areas.map((a: any) => a.estado_id);
      const nuevoEstadoEvaluacion = computeEvaluacionEstadoFromAreas(areaEstados);

      await tx.evaluacionEstudiante.update({
        where: { id: evaluacionId },
        data: { estado_id: nuevoEstadoEvaluacion },
      });

      return {
        area: {
          areaId,
          evaluacionAreaId: evalArea.id,
          estado: scoreResult.estadoFinalArea,
          puntaje: scoreResult.puntajeFinal,
          aciertosIndividuales: scoreResult.aciertosIndividuales,
          totalPreguntas: scoreResult.totalPreguntasActivas,
        },
        evaluacion: {
          id: evaluacionId,
          estado: nuevoEstadoEvaluacion,
        },
        areasSnapshot: areas.map((a: any) => ({
          areaId: a.area_id,
          estado: a.estado_id,
          puntaje: a.puntaje,
        })),
      };
    });
  },

  /**
   * Retorna el objeto `include` estándar usado en la mayoría de los listados.
   */
  _commonIncludes() {
    return {
      aulas: {
        select: {
          id: true,
          comision: true,
          turno: true,
        },
      },
      estudiantes: {
        include: {
          personas: { select: { nombre: true, primer_apellido: true, dni: true } },
          generos: { select: { descripcion: true } },
          salas: { select: { nombre: true, grado: true } },
          escuela: { select: { nombre: true } },
        },
      },
      profesores: {
        include: {
          personas: { select: { nombre: true, primer_apellido: true } },
        },
      },
      tipos_evaluacion: { select: { descripcion: true } },
      estados_evaluacion: { select: { descripcion: true } },
      evaluaciones_estudiante_area: {
        select: {
          id: true,
          area_id: true,
          estado_id: true,
          puntaje: true,
          areas: {
            select: {
              nombre: true,
              orden: true,
            },
          },
          estados_evaluacion: {
            select: {
              descripcion: true,
            },
          },
        },
        orderBy: {
          areas: { orden: "asc" as const },
        },
      },
    };
  },
};

/**
 * Calcula el puntaje final de un área a partir de las respuestas registradas.
 */
async function calculateAreaScore(
  tx: any,
  evaluacionAreaId: string,
  salaId: number,
  areaId: string
): Promise<{
  puntajeFinal: number;
  completado: boolean;
  totalPuntosPosibles: number;
  estadoFinalArea: string;
  aciertosIndividuales: number;
  totalPreguntasActivas: number;
}> {
  const ESTADO_EN_PROGRESO = "E";
  const ESTADO_APROBADA = "A";
  const ESTADO_DESAPROBADA = "D";

  const qas = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
    where: { evaluaciones_area_id: evaluacionAreaId },
    include: {
      preguntas: { select: { id: true, numero: true, activa: true, puntaje: true } },
    },
  });

  const activos = qas.filter((qa: any) => qa.preguntas && (qa.preguntas.activa === true || qa.preguntas.activa === null));

  if (activos.length === 0) {
    return {
      puntajeFinal: 0,
      completado: false,
      totalPuntosPosibles: 0,
      estadoFinalArea: ESTADO_EN_PROGRESO,
      aciertosIndividuales: 0,
      totalPreguntasActivas: 0,
    };
  }

  type GroupStats = { total: number; answered: number; correct: number; puntajes: number[] };
  const groups = new Map<number | string, GroupStats>();

  for (const qa of activos) {
    const groupKey = qa.preguntas.numero ?? `Q:${qa.pregunta_id}`;
    const g = groups.get(groupKey) ?? { total: 0, answered: 0, correct: 0, puntajes: [] };

    g.total += 1;

    const p = qa.preguntas.puntaje;
    g.puntajes.push((p === null || p === undefined) ? 1 : Number(p));

    if (qa.respuesta !== null && qa.respuesta !== undefined) {
      g.answered += 1;
      if (qa.respuesta === 1) g.correct += 1;
    }

    groups.set(groupKey, g);
  }

  const totalGrupos = groups.size;
  let completado = true;
  let gruposAprobados = 0;
  let puntajeFinal = 0;
  let totalPuntosPosibles = 0;

  for (const [groupKey, g] of groups) {
    if (g.answered < g.total) completado = false;

    const needed = Math.ceil(g.total / 2);
    const apruebaGrupo = g.correct >= needed;

    const unique = Array.from(new Set(g.puntajes));

    let groupValue: number;
    if (unique.length === 1) {
      groupValue = unique[0];
    } else {
      groupValue = Math.max(...unique);
      console.warn(`[calculateAreaScore] Grupo ${String(groupKey)} tiene puntajes distintos:`, unique, "-> usando", groupValue);
    }

    totalPuntosPosibles += groupValue;

    if (apruebaGrupo) {
      gruposAprobados += 1;
      puntajeFinal += groupValue;
    }
  }

  const areaRule = await tx.reglasAprobacion.findFirst({
    where: { sala_id: salaId, area_id: areaId },
    select: { aprueba_con: true, puntaje_total: true },
  });

  if (areaRule?.puntaje_total !== null && areaRule?.puntaje_total !== undefined) {
    totalPuntosPosibles = Number(areaRule.puntaje_total);
  }

  const requiredToPass =
    (areaRule?.aprueba_con !== null && areaRule?.aprueba_con !== undefined)
      ? Number(areaRule.aprueba_con)
      : Math.ceil(totalPuntosPosibles * 0.6);

  let estadoFinalArea = ESTADO_EN_PROGRESO;
  if (completado) {
    estadoFinalArea = puntajeFinal >= requiredToPass ? ESTADO_APROBADA : ESTADO_DESAPROBADA;
  } else if (Array.from(groups.values()).some(g => g.answered > 0)) {
    estadoFinalArea = ESTADO_EN_PROGRESO;
  }

  return {
    puntajeFinal,
    completado,
    totalPuntosPosibles,
    estadoFinalArea,
    aciertosIndividuales: gruposAprobados,
    totalPreguntasActivas: totalGrupos,
  };
}

/**
 * Determina el estado global de una evaluación a partir del estado de sus áreas.
 */
function computeEvaluacionEstadoFromAreas(areaEstados: string[]) {
  const allN = areaEstados.every(s => s === ESTADO_NO_INICIADA);
  if (allN) return ESTADO_NO_INICIADA;

  const anyE = areaEstados.some(s => s === ESTADO_EN_PROGRESO);
  if (anyE) return ESTADO_EN_PROGRESO;

  const allFinal = areaEstados.every(s => s === ESTADO_APROBADA || s === ESTADO_DESAPROBADA);
  if (!allFinal) return ESTADO_EN_PROGRESO;

  const allA = areaEstados.every(s => s === ESTADO_APROBADA);
  if (allA) return ESTADO_APROBADA;

  return ESTADO_DESAPROBADA;
}
