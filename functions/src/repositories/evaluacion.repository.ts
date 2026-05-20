import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/prismaClient";
import { select } from "firebase-functions/params";

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
 *
 * @remarks
 * Gestiona el ciclo de vida completo de una evaluación:
 * creación (con generación automática de registros por área), listado con filtros,
 * consulta de detalle (con cálculo de puntajes por grupo de preguntas),
 * guardado de respuestas (con actualización de estado y propagación al padre),
 * y eliminación en cascada.
 *
 * Los estados posibles son `"N"` (no iniciada), `"E"` (en progreso),
 * `"A"` (aprobada) y `"D"` (desaprobada).
 */
export const EvaluacionRepository = {
  /**
   * Busca un estudiante por su DNI y retorna su ID y sala.
   *
   * @param dni - DNI del estudiante.
   * @returns `{ id, sala_id }` o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
  async findEstudianteByDni(dni: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const txAny = prisma as any;
    return await txAny.estudiantes.findFirst({
      where: { personas: { dni } },
      select: { id: true, sala_id: true }
    });
  },

  /**
   * Crea una evaluación y genera automáticamente los registros de área.
   *
   * @remarks
   * En una sola transacción:
   * 1. Crea el registro en `evaluacionEstudiante` con estado `"N"`.
   * 2. Obtiene todas las áreas ordenadas por `orden`.
   * 3. Crea un registro en `evaluacionesEstudianteArea` por cada área con estado `"N"`.
   *
   * @param data - Datos de la evaluación a crear.
   * @returns El registro de evaluación creado (sin las áreas).
   * @throws Error si la base de datos no está disponible.
   */
  async create(data: {
    estudiante_id: string;
    profesor_id: string;
    sala_id: number;
    aula_id?: string;
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
          aula_id: data.aula_id ?? null,
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

  /**
   * Lista todas las evaluaciones asignadas a un docente.
   *
   * @param profesor_id - UUID del docente.
   * @returns Array de evaluaciones con aula, estudiante, tipo y estado, ordenadas por fecha descendente.
   */
  async findAllByProfesor(profesor_id: string) {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findMany({
      where: { profesor_id },
      include: {
        aulas: {
          select: { id: true, comision: true, turno: true },
        },
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

  /**
   * Lista todas las evaluaciones del sistema (uso exclusivo del rol `admin`).
   *
   * @returns Array completo de evaluaciones con relaciones estándar, ordenadas por fecha descendente.
   */
  async list() {
    const prisma = getPrisma();
    const txAny = prisma as any;
    return await txAny.evaluacionEstudiante.findMany({
      include: this._commonIncludes(),
      orderBy: { fecha_creacion: 'desc' }
    });
  },

  /**
   * Lista evaluaciones aplicando filtros opcionales con restricciones por rol.
   *
   * @remarks
   * Soporta filtrar por estudiante, docente, sala, tipo, estado, escuela única o
   * múltiples escuelas (`escuelaIds`, para encargados de zona).
   *
   * @param filters - Objeto de filtros opcionales.
   * @returns Array de evaluaciones filtradas con relaciones estándar.
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
    const prisma = getPrisma();
    const txAny = prisma as any;

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

    return await txAny.evaluacionEstudiante.findMany({
      where,
      include: this._commonIncludes(),
      orderBy: { fecha_creacion: "desc" },
    });
  },

  /**
   * Busca la asignación activa de un estudiante a un aula.
   *
   * @param estudianteId - UUID del estudiante.
   * @param aulaId - UUID del aula.
   * @returns El registro de `estudiantesAulas` con datos del aula, o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
  async findActiveEstudianteAula(estudianteId: string, aulaId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const txAny = prisma as any;

    return await txAny.estudiantesAulas.findFirst({
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
  },

  /**
   * Lista evaluaciones filtradas por escuela (para directores y docentes).
   *
   * @param escuelaId - UUID de la escuela.
   * @returns Array de evaluaciones donde el estudiante pertenece a esa escuela.
   */
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

  /**
   * Retorna el detalle completo de una evaluación, incluyendo puntajes calculados por área.
   *
   * @remarks
   * Enriquece cada área con los siguientes campos calculados:
   * - `aciertos_individuales`: grupos de preguntas aprobados.
   * - `totalPreguntas`: total de grupos activos.
   * - `totalPuntosPosibles`: suma de puntos máximos posibles.
   * - `puntajeFinal`: puntos obtenidos.
   * - `gruposRespondidos`: grupos donde todas las preguntas fueron respondidas.
   *
   * @param id - UUID de la evaluación.
   * @returns La evaluación con todas sus relaciones y puntajes calculados, o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
  async findById(id: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const txAny = prisma as any;

    const evaluacion = await txAny.evaluacionEstudiante.findUnique({
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

            // ✅ traemos las respuestas y su pregunta (para agrupar por numero y leer puntaje)
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

    // ✅ Enriquecemos cada área con aciertos/total por GRUPO
    for (const area of evaluacion.evaluaciones_estudiante_area) {
      const qas = area.evaluaciones_estudiante_area_preguntas || [];

      // solo activas (activa true o null)
      const activos = qas.filter((qa: any) => qa.preguntas && (qa.preguntas.activa === true || qa.preguntas.activa === null));

      // agrupar por "numero" (grupo)
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

      // ✅ campos que el front ya intenta leer (snake_case y camelCase)
      area.aciertos_individuales = gruposAprobados;
      area.totalPreguntas = totalGrupos;

      // opcionales (por si querés mostrar puntos)
      area.totalPuntosPosibles = totalPuntosPosibles;
      area.puntajeFinal = puntajeFinal;

      // si querés, también: cuántos grupos respondidos
      area.gruposRespondidos = Array.from(groups.values()).filter(g => g.answered === g.total).length;
    }

    return evaluacion;
  },

  /**
   * Elimina una evaluación y sus datos dependientes en una transacción.
   *
   * @remarks
   * Orden de eliminación:
   * 1. Verifica que la evaluación exista.
   * 2. Elimina las respuestas (`evaluacionesEstudianteAreaPreguntas`).
   * 3. Elimina los registros de área (`evaluacionesEstudianteArea`).
   * 4. Elimina la evaluación principal.
   *
   * @param id - UUID de la evaluación a eliminar.
   * @returns El registro de evaluación eliminado.
   * @throws Error si la evaluación no existe o si la operación falla.
   */
  async delete(id: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    try {
      return await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        // 1) Verificar existencia
        const exists = await txAny.evaluacionEstudiante.findUnique({
          where: { id },
          select: { id: true }
        });
        if (!exists) {
          throw new Error("La evaluación no existe");
        }

        // 2) Buscar áreas asociadas
        const areas = await txAny.evaluacionesEstudianteArea.findMany({
          where: { evaluacion_estudiante_id: id },
          select: { id: true }
        });

        const areaIds = areas.map((a: { id: string }) => a.id);

        // 3) Borrar respuestas (hijas) primero
        if (areaIds.length > 0) {
          await txAny.evaluacionesEstudianteAreaPreguntas.deleteMany({
            where: { evaluaciones_area_id: { in: areaIds } }
          });
        }

        // 4) Borrar áreas
        await txAny.evaluacionesEstudianteArea.deleteMany({
          where: { evaluacion_estudiante_id: id }
        });

        // 5) Borrar evaluación principal
        const deleted = await txAny.evaluacionEstudiante.delete({
          where: { id }
        });

        return deleted;
      });
    } catch (error: any) {
      // Para debug real: logueá el error de Prisma
      console.error("❌ Error en deleteEvaluacion:", error);

      // Si querés, podés mejorar el mensaje según error.code (P2003, etc.)
      throw new Error(error?.message || "Error al eliminar evaluación");
    }
  },

  /**
   * Retorna las preguntas activas de un área para una evaluación y las respuestas previas.
   *
   * @remarks
   * Filtra preguntas por `sala_id` de la evaluación y `area_id`, considerando
   * activas aquellas con `activa = true` o `activa = null`.
   * Retorna también las respuestas ya registradas para permitir reanudar el progreso.
   *
   * @param evaluacionId - UUID de la evaluación.
   * @param areaId - UUID del área.
   * @returns `{ preguntas, respuestas }` donde `respuestas` tiene `{ pregunta_id, respuesta }`.
   * @throws Error si la evaluación o el área no se encuentran.
   */
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

  /**
   * Guarda (o actualiza) las respuestas de un área y recalcula su estado y puntaje.
   *
   * @remarks
   * En una sola transacción:
   * 1. Hace upsert de cada respuesta en `evaluacionesEstudianteAreaPreguntas`.
   * 2. Recalcula el puntaje del área con `calculateAreaScore`.
   * 3. Actualiza `estado_id` y `puntaje` en `evaluacionesEstudianteArea`.
   * 4. Propaga el estado resultante a la evaluación padre con `computeEvaluacionEstadoFromAreas`.
   *
   * @param evaluacionId - UUID de la evaluación.
   * @param areaId - UUID del área.
   * @param questions - Array de `{ id, answer }` con las respuestas.
   * @returns Objeto con el estado del área, la evaluación y un snapshot de todas las áreas.
   * @throws Error si la evaluación o el área no se encuentran.
   */
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

      // Propagar estado a la evaluacion padre segun estados de áreas
      const areas = await txAny.evaluacionesEstudianteArea.findMany({
        where: { evaluacion_estudiante_id: evaluacionId },
        select: { estado_id: true }
      });

      const areaEstados = areas.map((a: any) => a.estado_id);
      const nuevoEstadoEvaluacion = computeEvaluacionEstadoFromAreas(areaEstados);

      await txAny.evaluacionEstudiante.update({
        where: { id: evaluacionId },
        data: { estado_id: nuevoEstadoEvaluacion }
      });

      //util para el front
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
   *
   * @remarks
   * Centraliza los joins de `aulas`, `estudiantes` (con persona, género, sala y escuela),
   * `profesores`, `tipos_evaluacion`, `estados_evaluacion` y las áreas con su estado.
   *
   * @returns Objeto `include` compatible con Prisma.
   */
  _commonIncludes() {
    return {
      aulas: {
        select: {
          id: true,
          comision: true,
          turno: true,
        }
      },
      estudiantes: {
        include: {
          personas: { select: { nombre: true, primer_apellido: true, dni: true } },
          generos: { select: { descripcion: true } },
          salas: { select: { nombre: true, grado: true } },
          escuela: { select: { nombre: true } }
        }
      },
      profesores: {
        include: {
          personas: { select: { nombre: true, primer_apellido: true } }
        }
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
              orden: true
            }
          },
          estados_evaluacion: {
            select: {
              descripcion: true
            }
          }
        },
        orderBy: {
          areas: { orden: "asc" }
        }
      }
    }
  }

};

/**
 * Calcula el puntaje final de un área a partir de las respuestas registradas.
 *
 * @remarks
 * Las preguntas se agrupan por `numero` (grupo). Un grupo se aprueba si al menos
 * la mitad de sus preguntas tienen `respuesta = 1`. El valor del grupo es el puntaje
 * máximo entre sus preguntas. El estado final del área se determina contra las
 * `reglasAprobacion` de esa sala/área; si no hay regla, el umbral es el 60% del total.
 *
 * @param tx - Transacción de Prisma activa.
 * @param evaluacionAreaId - ID del registro de área (`evaluacionesEstudianteArea`).
 * @param salaId - ID de sala (para filtrar preguntas activas).
 * @param areaId - UUID del área.
 * @returns Objeto con puntajeFinal, completado, totalPuntosPosibles, estadoFinalArea,
 *          aciertosIndividuales y totalPreguntasActivas.
 */
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
  totalPreguntasActivas: number //total de grupos
}> {
  const ESTADO_EN_PROGRESO = "E";
  const ESTADO_APROBADA = "A";
  const ESTADO_DESAPROBADA = "D";

  const qas = await tx.evaluacionesEstudianteAreaPreguntas.findMany({
    where: { evaluaciones_area_id: evaluacionAreaId },
    include: {
      preguntas: { select: { id: true, numero: true, activa: true, puntaje: true } }
    }
  });

  const activos = qas.filter((qa: any) => qa.preguntas && (qa.preguntas.activa === true || qa.preguntas.activa === null));

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

  type GroupStats = { total: number; answered: number; correct: number; puntajes: number[] };
  const groups = new Map<number | string, GroupStats>();

  for (const qa of activos) {
    const groupKey = qa.preguntas.numero ?? `Q:${qa.pregunta_id}`;
    const g = groups.get(groupKey) ?? { total: 0, answered: 0, correct: 0, puntajes: [] };

    g.total += 1;

    const p = qa.preguntas.puntaje;
    // si puntaje viene null, asumimos 1
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

  // total puntos posibles: suma del valor del grupo (según su puntaje)
  let totalPuntosPosibles = 0;

  for (const [groupKey, g] of groups) {
    if (g.answered < g.total) completado = false;

    const needed = Math.ceil(g.total / 2);
    const apruebaGrupo = g.correct >= needed;

    //valor del grupo según puntajes de sus preguntas
    const unique = Array.from(new Set(g.puntajes));

    let groupValue: number;
    if (unique.length === 1) {
      groupValue = unique[0];
    } else {
      //hay preguntas del mismo grupo con puntajes distintos
      // decisión: usamos el maximo valor como valor de ese grupo
      groupValue = Math.max(...unique);

      // Log para que detectes datos raros
      console.warn(`[calculateAreaScore] Grupo ${String(groupKey)} tiene puntajes distintos:`, unique, "-> usando", groupValue);
    }

    totalPuntosPosibles += groupValue;

    if (apruebaGrupo) {
      gruposAprobados += 1;
      puntajeFinal += groupValue;
    }
  }

  // regla del area: minimo para aprobar
  const areaRule = await tx.reglasAprobacion.findFirst({
    where: { sala_id: salaId, area_id: areaId },
    select: { aprueba_con: true, puntaje_total: true }
  });

  // Si en reglas_aprobacion puntaje_total existe, preferimos ese como total máximo
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
    aciertosIndividuales: gruposAprobados, // util para UI (grupos ganados)
    totalPreguntasActivas: totalGrupos
  };
}

/**
 * Determina el estado global de una evaluación a partir del estado de sus áreas.
 *
 * @remarks
 * Reglas de derivación:
 * - Todas `"N"` → `"N"` (no iniciada).
 * - Al menos una `"E"` → `"E"` (en progreso).
 * - Todas finalizadas (`"A"` o `"D"`) y todas `"A"` → `"A"` (aprobada).
 * - Todas finalizadas con alguna `"D"` → `"D"` (desaprobada).
 *
 * @param areaEstados - Array de estados de todas las áreas de la evaluación.
 * @returns El estado derivado: `"N"`, `"E"`, `"A"` o `"D"`.
 */
function computeEvaluacionEstadoFromAreas(areaEstados: string[]) {
  const allN = areaEstados.every(s => s === ESTADO_NO_INICIADA);
  if (allN) return ESTADO_NO_INICIADA;

  const anyE = areaEstados.some(s => s === ESTADO_EN_PROGRESO);
  if (anyE) return ESTADO_EN_PROGRESO;

  // finalizadas: solo A o D (si tuvieras "C", incluirlo como finalizada)
  const allFinal = areaEstados.every(s => s === ESTADO_APROBADA || s === ESTADO_DESAPROBADA);
  if (!allFinal) return ESTADO_EN_PROGRESO;

  const allA = areaEstados.every(s => s === ESTADO_APROBADA);
  if (allA) return ESTADO_APROBADA;

  // todas finalizadas y alguna D
  return ESTADO_DESAPROBADA;
}
