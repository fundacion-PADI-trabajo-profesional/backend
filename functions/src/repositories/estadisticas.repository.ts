import { withRLSContext } from "../config/prismaClient";

// Límite de seguridad para queries de estadísticas sin paginación.
// Si se supera, se lanza error en lugar de calcular sobre datos incompletos.
const MAX_EVALUACIONES_POR_QUERY = 50_000;

export const EstadisticasRepository = {
  /**
   * Obtiene todas las áreas de evaluación ordenadas por su campo `orden`.
   *
   * @returns Lista de áreas con `id`, `nombre` y `orden`.
   */
  async findAreas() {
    return withRLSContext(async (tx) => {
      const rows = await tx.areas.findMany({
        select: { id: true, nombre: true, orden: true },
        orderBy: { orden: "asc" },
      });
      return rows.map((r) => ({ ...r, nombre: r.nombre ?? "" }));
    });
  },

  /**
   * Obtiene todas las reglas de aprobación definidas para cada combinación
   * de área y sala, incluyendo el puntaje total máximo posible.
   *
   * @returns Lista de reglas con `area_id`, `sala_id` y `puntaje_total`.
   */
  async findReglasAprobacion() {
    return withRLSContext(async (tx) => {
      return tx.reglasAprobacion.findMany({
        select: { area_id: true, sala_id: true, puntaje_total: true },
      });
    });
  },

  /**
   * Obtiene evaluaciones de estudiantes con sus puntajes por área, aplicando
   * filtros de período, tipo de evaluación y opcionalmente por zona o escuela.
   * Incluye datos relacionados del aula, escuela y zona para poder agrupar
   * resultados en distintos niveles geográficos.
   *
   * Solo se incluyen registros de área con estado `"A"` (aprobado) o `"D"` (desaprobado).
   *
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @param filtros.tipo         - Tipo de evaluación (`"inicial"` o `"final"`).
   * @param filtros.zonaId       - (Opcional) Filtra evaluaciones de escuelas pertenecientes a esta zona.
   * @param filtros.escuelaId    - (Opcional) Filtra evaluaciones de esta escuela en particular.
   * @returns Lista de evaluaciones con sus relaciones de aula, escuela, zona y puntajes por área.
   */
  async findEvaluacionesParaHeatmap(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    tipo: string;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {

      const where: any = {
        tipo_id: filtros.tipo,
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };

      const geoConditions: any[] = [];

      if (filtros.zonaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela: { zona_id: filtros.zonaId } } },
            { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
          ],
        });
      }

      if (filtros.escuelaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela_id: filtros.escuelaId } },
            { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
          ],
        });
      }

      if (geoConditions.length === 1) {
        where.OR = geoConditions[0].OR;
      } else if (geoConditions.length > 1) {
        where.AND = geoConditions;
      }

      const rows = await tx.evaluacionEstudiante.findMany({
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
              sala: { select: { id: true, nombre: true } },
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones. Aplicá un filtro de zona o escuela.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene evaluaciones de estudiantes con datos personales y de escuela/zona
   * para calcular qué estudiantes están en riesgo académico.
   * A diferencia de `findEvaluacionesParaHeatmap`, no filtra por tipo de
   * evaluación y trae el nombre y apellido del estudiante.
   *
   * Solo se incluyen registros de área con estado `"A"` o `"D"`.
   *
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @param filtros.zonaId       - (Opcional) Filtra por zona.
   * @param filtros.escuelaId    - (Opcional) Filtra por escuela.
   * @returns Lista de evaluaciones con datos del estudiante (nombre, escuela, zona) y puntajes por área.
   */
  async findEvaluacionesParaRiesgo(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {

      const where: any = {
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };

      const geoConditions: any[] = [];

      if (filtros.zonaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela: { zona_id: filtros.zonaId } } },
            { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
          ],
        });
      }

      if (filtros.escuelaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela_id: filtros.escuelaId } },
            { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
          ],
        });
      }

      if (geoConditions.length === 1) {
        where.OR = geoConditions[0].OR;
      } else if (geoConditions.length > 1) {
        where.AND = geoConditions;
      }

      const rows = await tx.evaluacionEstudiante.findMany({
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones. Aplicá un filtro de zona o escuela.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene evaluaciones con el nivel socioeconómico de la escuela del estudiante,
   * para calcular rendimiento segmentado por nivel socioeconómico.
   *
   * Solo se incluyen registros de área con estado `"A"` o `"D"`.
   *
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @param filtros.tipo         - Tipo de evaluación (`"inicial"` o `"final"`).
   * @returns Lista de evaluaciones con el `nivel_socioeconomico` de la escuela y puntajes por área.
   */
  async findEvaluacionesPorNivelSocioeconomico(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    tipo: string;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones. Aplicá un filtro de período más acotado.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene el ID de la zona asignada a un encargado de zona dado su ID de usuario.
   *
   * @param usuarioId - ID del usuario con rol `encargado_zona`.
   * @returns El `zona_id` del encargado, o `null` si no se encuentra el registro.
   */
  async findZonaIdDeEncargado(usuarioId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const enc = await tx.encargados.findUnique({
        where: { usuario_id: usuarioId },
        select: { zona_id: true },
      });
      return enc?.zona_id ?? null;
    });
  },

  /**
   * Obtiene el ID del perfil de profesor asociado a un usuario.
   * Busca la persona vinculada al usuario y devuelve el ID de su primer registro
   * de profesor.
   *
   * @param usuarioId - ID del usuario con rol `docente`.
   * @returns El `id` del profesor, o `null` si el usuario no tiene perfil de profesor.
   */
  async findProfesorIdDeUsuario(usuarioId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const persona = await tx.personas.findUnique({
        where: { usuario_id: usuarioId },
        select: { profesores: { select: { id: true }, take: 1 } },
      });
      return persona?.profesores?.[0]?.id ?? null;
    });
  },

  /**
   * Verifica si un profesor tiene asignación activa en un aula específica.
   * Una asignación se considera activa cuando `fecha_fin` es `null`.
   *
   * @param profesorId - ID del profesor.
   * @param aulaId     - ID del aula a verificar.
   * @returns `true` si el profesor está actualmente asignado al aula, `false` en caso contrario.
   */
  async findAulaDelProfesor(profesorId: string, aulaId: string): Promise<boolean> {
    return withRLSContext(async (tx) => {
      const entry = await tx.profesoresAulas.findFirst({
        where: { profesor_id: profesorId, aula_id: aulaId, fecha_fin: null },
      });
      return entry != null;
    });
  },

  /**
   * Obtiene las respuestas individuales por pregunta de todas las evaluaciones
   * de un aula en un período dado. Opcionalmente filtra por área.
   * Usado para calcular la tasa de aprobación por pregunta.
   *
   * Solo se incluyen registros de área con estado `"A"` o `"D"`.
   *
   * @param filtros.aulaId       - ID del aula.
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @param filtros.areaId       - (Opcional) Filtra por área específica.
   * @returns Lista de evaluaciones con sus áreas y las respuestas por pregunta
   *          (incluyendo metadatos de la pregunta: consigna, título, área).
   */
  async findRespuestasPorAula(filtros: {
    aulaId: string;
    periodoStart: Date;
    periodoEnd: Date;
    areaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones para el aula.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene todas las evaluaciones de los estudiantes de un aula en un período,
   * con sus puntajes por área. Usado para calcular la distribución de puntajes
   * dentro de un aula.
   *
   * Solo se incluyen registros de área con estado `"A"` o `"D"`.
   *
   * @param filtros.aulaId       - ID del aula.
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @returns Lista de evaluaciones con `id`, `sala_id`, `estudiante_id` y puntajes por área.
   */
  async findEvaluacionesParaAula(filtros: {
    aulaId: string;
    periodoStart: Date;
    periodoEnd: Date;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones para el aula.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene el listado de evaluaciones con el `profesor_id` que las registró
   * y los datos personales del profesor, para contabilizar la actividad docente.
   * Aplica filtros opcionales por zona o escuela.
   *
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @param filtros.zonaId       - (Opcional) Filtra por zona.
   * @param filtros.escuelaId    - (Opcional) Filtra por escuela.
   * @returns Lista de evaluaciones con `profesor_id` y datos personales del profesor.
   */
  async findActividadDocentes(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
    zonaId?: string;
    escuelaId?: string;
  }) {
    return withRLSContext(async (tx) => {
      const where: any = {
        fecha_creacion: { gte: filtros.periodoStart, lt: filtros.periodoEnd },
      };
      const geoConditions: any[] = [];

      if (filtros.zonaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela: { zona_id: filtros.zonaId } } },
            { aula_id: null, estudiantes: { escuela: { zona_id: filtros.zonaId } } },
          ],
        });
      }

      if (filtros.escuelaId) {
        geoConditions.push({
          OR: [
            { aulas: { escuela_id: filtros.escuelaId } },
            { aula_id: null, estudiantes: { escuela_id: filtros.escuelaId } },
          ],
        });
      }

      if (geoConditions.length === 1) {
        where.OR = geoConditions[0].OR;
      } else if (geoConditions.length > 1) {
        where.AND = geoConditions;
      }

      const rows = await tx.evaluacionEstudiante.findMany({
        where,
        select: {
          profesor_id: true,
          profesores: {
            select: {
              personas: { select: { nombre: true, primer_apellido: true } },
            },
          },
        },
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones. Aplicá un filtro de zona o escuela.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene todas las evaluaciones del período con los datos de zona de cada
   * estudiante (a través del aula o directamente desde el estudiante).
   * Usado para calcular la cobertura de evaluaciones por zona.
   *
   * @param filtros.periodoStart - Fecha de inicio del período (inclusive).
   * @param filtros.periodoEnd   - Fecha de fin del período (exclusiva).
   * @returns Lista de evaluaciones con `estudiante_id` y datos de zona del estudiante.
   */
  async findEvaluacionesPorZona(filtros: {
    periodoStart: Date;
    periodoEnd: Date;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
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
        take: MAX_EVALUACIONES_POR_QUERY + 1,
      });

      if (rows.length > MAX_EVALUACIONES_POR_QUERY) {
        throw new Error(
          `La consulta supera el límite de ${MAX_EVALUACIONES_POR_QUERY} evaluaciones. El período seleccionado contiene demasiados datos.`
        );
      }

      return rows;
    });
  },

  /**
   * Obtiene el ID de la zona a la que pertenece una escuela.
   *
   * @param escuelaId - ID de la escuela.
   * @returns El `zona_id` de la escuela, o `null` si la escuela no existe o no tiene zona asignada.
   */
  async findZonaIdDeEscuela(escuelaId: string): Promise<string | null> {
    return withRLSContext(async (tx) => {
      const esc = await tx.escuelas.findUnique({
        where: { id: escuelaId },
        select: { zona_id: true },
      });
      return esc?.zona_id ?? null;
    });
  },

  /**
   * Obtiene las últimas N evaluaciones de un estudiante ordenadas cronológicamente
   * (de más antigua a más reciente), con sus puntajes por área.
   * Usado para construir la progresión histórica del estudiante.
   *
   * Solo se incluyen registros de área con estado `"A"` o `"D"`.
   *
   * @param filtros.estudianteId - ID del estudiante.
   * @param filtros.limit        - Cantidad máxima de evaluaciones a retornar.
   * @returns Lista de evaluaciones en orden cronológico ascendente con `id`, `sala_id`,
   *          `tipo_id`, `fecha_creacion` y puntajes por área.
   */
  async findUltimasEvaluaciones(filtros: {
    estudianteId: string;
    limit: number;
  }) {
    return withRLSContext(async (tx) => {
      const rows = await tx.evaluacionEstudiante.findMany({
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

  /**
   * Verifica que un estudiante pertenece a una escuela específica y retorna
   * sus datos personales. Usado para validar el acceso en la vista de director
   * o encargado de zona.
   *
   * @param estudianteId - ID del estudiante a verificar.
   * @param escuelaId    - ID de la escuela en la que se busca al estudiante.
   * @returns Objeto con `nombre` y `primer_apellido` del estudiante, o `null` si
   *          el estudiante no pertenece a esa escuela.
   */
  async findEstudianteEnEscuela(
    estudianteId: string,
    escuelaId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await tx.estudiantes.findFirst({
        where: { id: estudianteId, escuela_id: escuelaId },
        select: { personas: { select: { nombre: true, primer_apellido: true } } },
      });
      return est
        ? { nombre: est.personas?.nombre ?? null, primer_apellido: est.personas?.primer_apellido ?? null }
        : null;
    });
  },

  /**
   * Verifica que un estudiante está matriculado en alguna de las aulas asignadas
   * a un profesor específico y retorna sus datos personales.
   * Usado para validar que un docente puede consultar la progresión de ese estudiante.
   *
   * @param estudianteId - ID del estudiante a verificar.
   * @param profesorId   - ID del profesor que realiza la consulta.
   * @returns Objeto con `nombre` y `primer_apellido` del estudiante, o `null` si
   *          el estudiante no está en ninguna aula del profesor.
   */
  async findEstudianteEnAulasDeProfesor(
    estudianteId: string,
    profesorId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await tx.estudiantes.findFirst({
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

  /**
   * Verifica que un estudiante está matriculado en un aula específica y retorna
   * sus datos personales. Usado como control de acceso cuando el consultante
   * no es el docente asignado al aula (ej. director o encargado de zona).
   *
   * @param estudianteId - ID del estudiante a verificar.
   * @param aulaId       - ID del aula en la que se busca al estudiante.
   * @returns Objeto con `nombre` y `primer_apellido` del estudiante, o `null` si
   *          el estudiante no está matriculado en esa aula.
   */
  async findSalaIdDeAula(aulaId: string): Promise<number | null> {
    return withRLSContext(async (tx) => {
      const aula = await tx.aulas.findUnique({
        where: { id: aulaId },
        select: { sala_id: true },
      });
      return aula?.sala_id ?? null;
    });
  },

  async findPreguntasPorSala(filtros: { salaId: number; areaId?: string }) {
    return withRLSContext(async (tx) => {
      return tx.preguntas.findMany({
        where: {
          sala_id: filtros.salaId,
          activa: true,
          ...(filtros.areaId ? { area_id: filtros.areaId } : {}),
        },
        select: { id: true, consigna: true, titulo: true, area_id: true },
      });
    });
  },

  async findEstudianteEnAula(
    estudianteId: string,
    aulaId: string
  ): Promise<{ nombre: string | null; primer_apellido: string | null } | null> {
    return withRLSContext(async (tx) => {
      const est = await tx.estudiantes.findFirst({
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
