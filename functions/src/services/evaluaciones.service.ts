import { EvaluacionRepository } from "../repositories/evaluacion.repository";
import type { CreateEvaluacionDTO } from "../interfaces/evaluacion.interface";
import { getPrisma } from "../config/prismaClient";

/**
 * Servicio de gestión de evaluaciones infantiles.
 * * @remarks
 * Este servicio centraliza la lógica de creación y consulta de evaluaciones. 
 * Incluye un flujo de "auto-registro" de perfiles de evaluador mediante 
 * `ensureProfesorRecord` para garantizar la integridad referencial antes de 
 * persistir una evaluación.
 */
export class EvaluacionService {
  private repo = EvaluacionRepository;

  /**
   * Garantiza que el usuario tenga un registro en la tabla de profesores y personas.
   * * @remarks
   * Este método es vital para la primera evaluación de un usuario. Si el usuario
   * es válido (docente, director, encargado o PADI) pero no tiene perfil de 
   * profesor, se crea automáticamente extrayendo datos de `usuarioPerfil`.
   * * @param userId - UUID del usuario que realiza la acción.
   * @throws Error si la base de datos no está disponible o el rol del usuario no es apto.
   */
  private async ensureProfesorRecord(userId: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible");
    const prismaAny = prisma as any;

    const existing = await prismaAny.profesores.findUnique({ where: { id: userId } });
    if (existing) return;

    const user = await prismaAny.usuarioPerfil.findUnique({
      where: { id: userId },
      select: { id: true, nombre: true, apellido: true, rol: true },
    });
    if (!user) throw new Error("Usuario no encontrado.");
    if (user.rol !== "director" && user.rol !== "docente" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
      throw new Error("Solo docentes, directores, encargados de zona y equipo PADI pueden realizar evaluaciones.");
    }

    let persona = await prismaAny.personas.findFirst({ where: { usuario_id: userId } });
    if (!persona) {
      persona = await prismaAny.personas.create({
        data: {
          usuario_id: userId,
          nombre: user.nombre,
          primer_apellido: user.apellido,
        },
      });
    }

    await prismaAny.profesores.create({
      data: { id: userId, persona_id: persona.id },
    });
  }


  /**
   * Registra una nueva evaluación en el sistema.
   * * @remarks
   * Implementa una lógica de seguridad por rol: 
   * - Valida que el usuario tenga un rol autorizado.
   * - Si el usuario es `docente` o `director`, se fuerza su propio ID como `profesor_id` 
   * para evitar suplantación de identidad en el registro.
   * - Realiza validaciones de integridad: existencia del estudiante por DNI y 
   * verificación de asignación activa si se provee un `aula_id`.
   * * @param data - DTO con los datos de la evaluación (DNI, tipo, fecha, etc.).
   * @param user - Datos del usuario autenticado que realiza la acción.
   * @returns La evaluación creada con sus relaciones iniciales.
   * @throws Error si el rol no es válido, el estudiante no existe o la asignación al aula no es activa.
   */
  async createEvaluacion(data: CreateEvaluacionDTO, user: { id: string; rol: string }) {
    // Validar permisos para crear evaluación
    const allowedRoles = ["director", "docente", "encargado_zona", "equipo_padi"];
    if (!allowedRoles.includes(user.rol)) {
      throw new Error("No tienes permisos para crear evaluaciones.");
    }

    let profesorIdFinal = data.profesor_id;
    if (user.rol === "docente" || user.rol === "director") {
      profesorIdFinal = user.id;
    }

    await this.ensureProfesorRecord(profesorIdFinal);

    const estudiante = await this.repo.findEstudianteByDni(data.dni);
    if (!estudiante) throw new Error("Estudiante no encontrado");

    const salaId = data.sala_id || estudiante.sala_id;
    let aulaId: string | undefined = undefined;

    if (data.aula_id) {
      const asignacion = await this.repo.findActiveEstudianteAula(estudiante.id, data.aula_id);
      if (!asignacion?.aula) {
        throw new Error("El estudiante no está asignado activamente al aula indicada.");
      }
      aulaId = data.aula_id;
    }

    return await this.repo.create({
      estudiante_id: estudiante.id,
      profesor_id: profesorIdFinal,
      sala_id: salaId,
      aula_id: aulaId,
      tipo_id: data.tipo_id,
      fecha_creacion: new Date(data.fecha_creacion)
    });
  }


  /**
   * Obtiene todas las evaluaciones realizadas por un profesor específico.
   * * @param profesorId - UUID del profesor (vinculado a la tabla `personas`).
   * @returns Array de evaluaciones asociadas al docente.
   */
  async getListByDocente(profesorId: string) {
    return await this.repo.findAllByProfesor(profesorId);
  }


  /**
   * Recupera el listado global de evaluaciones.
   * * @remarks
   * Utilizado principalmente por el rol `equipo_padi` para auditoría o reportes generales.
   */
  async list() {
    return await this.repo.list();
  }

  /**
   * Lista evaluaciones aplicando filtros dinámicos.
   * * @param filters - Criterios de búsqueda (estudiante, profesor, sala, escuela, etc.).
   * @returns Lista de evaluaciones que coinciden con los criterios.
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
    return await this.repo.listWithFilters(filters);
  }


  /**
   * Filtra las evaluaciones pertenecientes a una institución específica.
   * * @param escuelaId - UUID de la escuela.
   * @returns Listado de evaluaciones de estudiantes vinculados a dicha escuela.
   */
  async listByEscuela(escuelaId: string) {
    return await this.repo.listByEscuela(escuelaId);
  }


  /**
   * Obtiene la información detallada de una evaluación específica.
   * * @param id - UUID de la evaluación.
   * @returns Objeto de la evaluación con sus metadatos.
   * @throws Error si el ID no corresponde a ninguna evaluación existente.
   */
  async getDetalle(id: string) {
    const evaluacion = await this.repo.findById(id);
    if (!evaluacion) throw new Error("Evaluación no encontrada");
    return evaluacion;
  }

  /**
   * Elimina una evaluación del sistema con validación de autoría.
   * * @remarks
   * Los usuarios con rol `"docente"` solo pueden eliminar evaluaciones que 
   * ellos mismos hayan creado. Otros roles administrativos tienen permisos globales.
   * * @param id - UUID de la evaluación a eliminar.
   * @param user - Objeto con el ID y rol del usuario autenticado.
   * @throws Error si la evaluación no existe o el docente intenta borrar una ajena.
   */
  async remove(id: string, user: { id: string; rol: string }) {
    const evaluacion = await this.repo.findById(id);
    if (!evaluacion) throw new Error("Evaluación no encontrada");

    if (user.rol === "docente" && evaluacion.profesor_id !== user.id) {
      throw new Error("No tenés permiso para eliminar una evaluación que no creaste.");
    }

    return await this.repo.delete(id);
  }


  /**
   * Recupera las preguntas y respuestas asociadas a un área específica dentro de una evaluación.
   * * @param evaluacionId - UUID de la evaluación en curso.
   * @param areaId - ID del área de desarrollo (Motor, Socio-emocional, etc.).
   * @returns Listado de preguntas con sus respectivos estados de respuesta.
   */
  async getPreguntasArea(evaluacionId: string, areaId: string) {
    return await this.repo.getPreguntasArea(evaluacionId, areaId);
  }


  /**
   * Persiste de forma masiva las respuestas para las preguntas de un área.
   * * @remarks
   * Este método gestiona la actualización de los instrumentos de evaluación. 
   * Se espera un array de preguntas donde el valor `answer` representa la escala 
   * de puntuación definida para el ítem.
   * * @param evaluacionId - UUID de la evaluación.
   * @param areaId - ID del área que se está calificando.
   * @param questions - Array de objetos con `id` de pregunta y el valor de la respuesta.
   */
  async guardarRespuestas(evaluacionId: string, areaId: string, questions: { id: string; answer: number | null }[]) {
    return await this.repo.saveRespuestas(evaluacionId, areaId, questions);
  }
}