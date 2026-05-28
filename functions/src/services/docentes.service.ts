import { DocenteRepository } from "../repositories/docente.repository";
import type { DocenteItem } from "../interfaces/docente.interface";
import { withRLSContext } from "../config/prismaClient";
import { getEncargadoZonaId, escuelaPerteneceAZona } from "../utils/scope";

/**
 * Servicio de gestión de docentes y sus asignaciones a escuelas.
 *
 * @remarks
 * Aplica control de acceso por rol y transforma los datos crudos del repositorio
 * en el formato que espera el frontend (aplanando `profesores_aulas` y `profesores_escuelas`).
 */
export class DocentesService {
  private repo = DocenteRepository;

  /**
   * Obtiene el UUID de la escuela asignada al director autenticado.
   *
   * @param usuarioId - UUID del usuario con rol `"director"`.
   * @returns UUID de la escuela del director.
   * @throws Error si el perfil no existe o el director no tiene escuela asignada.
   */
  private async getDirectorEscuelaId(usuarioId: string): Promise<string> {
    return withRLSContext(async (tx) => {
      const director = await tx.usuarioPerfil.findUnique({
        where: { id: usuarioId },
        select: { rol: true, escuela_id: true },
      });

      if (!director || director.rol !== "director") {
        throw new Error("Perfil de director no encontrado.");
      }
      if (!director.escuela_id) {
        throw new Error("El director no tiene colegio asignado.");
      }
      return director.escuela_id;
    });
  }

  /**
   * Transforma las filas crudas del repositorio en el formato de respuesta del frontend.
   *
   * @remarks
   * Aplana `profesores_escuelas` → `escuelas[]` y `profesores_aulas` → `aulas[]`,
   * descartando asignaciones inactivas (el repositorio ya filtra por `fecha_fin: null`).
   *
   * @param rows - Array de {@link DocenteItem} retornado por el repositorio.
   * @returns Array transformado con `{ id, nombre, apellido, escuelas, aulas }`.
   */
  private mapRows(rows: DocenteItem[]) {
    return rows.map((row) => ({
      id: row.id,
      nombre: row.personas?.nombre ?? "",
      apellido: row.personas?.primer_apellido ?? "",
      escuelas: (row.profesores_escuelas || []).map((pe) => ({
        id: pe.escuela.id,
        nombre: pe.escuela.nombre ?? "",
      })),
      aulas: (row.profesores_aulas || []).map((pa) => ({
        id: pa.aula.id,
        comision: pa.aula.comision,
        turno: pa.aula.turno,
        grado: pa.aula.sala?.grado ?? null,
        escuelaNombre: pa.aula.escuela?.nombre ?? null,
      })),
    }));
  }

  /**
   * Lista docentes según el scope del rol del usuario autenticado.
   *
   * @remarks
   * - `"equipo_padi"` y `"encargado_zona"`: todos los docentes.
   * - `"director"`: solo los docentes asignados a su escuela.
   *
   * @param user - Usuario autenticado.
   * @returns Array de docentes transformados con escuelas y aulas activas.
   * @throws Error si el rol no tiene permisos de lectura.
   */
  async list(user: { id: string; rol: string }) {
    let rows: DocenteItem[] = [];

    if (user.rol === "equipo_padi") {
      rows = await this.repo.list();
    } else if (user.rol === "encargado_zona") {
      const zonaId = await getEncargadoZonaId(user.id);
      rows = await this.repo.listByZona(zonaId);
    } else if (user.rol === "director") {
      const escuelaId = await this.getDirectorEscuelaId(user.id);
      rows = await this.repo.listByEscuela(escuelaId);
    } else {
      throw new Error("No tienes permisos para ver docentes.");
    }

    return this.mapRows(rows);
  }

  /**
   * Asigna un docente a una escuela, verificando que ambos existan.
   *
   * @param profesorId - UUID del docente.
   * @param escuelaId - UUID de la escuela.
   * @param user - Usuario autenticado (debe ser `"equipo_padi"` o `"encargado_zona"`).
   * @returns El registro de asignación creado con datos de la escuela.
   * @throws Error si el docente o la escuela no existen, o si el usuario no tiene permisos.
   */
  async assignEscuela(
    profesorId: string,
    escuelaId: string,
    user: { id: string; rol: string },
  ) {
    if (user.rol !== "equipo_padi" && user.rol !== "encargado_zona") {
      throw new Error("No tienes permisos para asignar docentes a colegios.");
    }

    if (user.rol === "encargado_zona") {
      const zonaId = await getEncargadoZonaId(user.id);
      const pertenece = await escuelaPerteneceAZona(escuelaId, zonaId);
      if (!pertenece) throw new Error("No tenés permisos para asignar docentes en esa escuela.");
    }

    const [profesor, escuela] = await withRLSContext(async (tx) => {
      return Promise.all([
        tx.profesores.findUnique({ where: { id: profesorId }, select: { id: true } }),
        tx.escuelas.findUnique({ where: { id: escuelaId }, select: { id: true } }),
      ]);
    });

    if (!profesor) throw new Error("Docente no encontrado.");
    if (!escuela) throw new Error("Colegio no encontrado.");

    return this.repo.addEscuela(profesorId, escuelaId);
  }

  /**
   * Desasigna un docente de una escuela y cierra sus asignaciones de aula activas.
   *
   * @param profesorId - UUID del docente.
   * @param escuelaId - UUID de la escuela.
   * @param user - Usuario autenticado (debe ser `"equipo_padi"` o `"encargado_zona"`).
   * @throws Error si el usuario no tiene permisos.
   */
  async unassignEscuela(
    profesorId: string,
    escuelaId: string,
    user: { id: string; rol: string },
  ) {
    if (user.rol !== "equipo_padi" && user.rol !== "encargado_zona") {
      throw new Error("No tienes permisos para desasignar docentes de colegios.");
    }

    if (user.rol === "encargado_zona") {
      const zonaId = await getEncargadoZonaId(user.id);
      const pertenece = await escuelaPerteneceAZona(escuelaId, zonaId);
      if (!pertenece) throw new Error("No tenés permisos para desasignar docentes de esa escuela.");
    }

    return this.repo.removeEscuela(profesorId, escuelaId);
  }
}
