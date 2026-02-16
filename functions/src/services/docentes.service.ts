import { DocenteRepository } from "../repositories/docente.repository";
import type { DocenteItem } from "../interfaces/docente.interface";
import { getPrisma } from "../config/prismaClient";

export class DocentesService {
  private repo = DocenteRepository;

  private async getDirectorEscuelaId(usuarioId: string): Promise<string> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible para listar docentes");
    const prismaAny = prisma as any;

    const director = await prismaAny.usuarioPerfil.findUnique({
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
  }

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

  async list(user: { id: string; rol: string }) {
    let rows: DocenteItem[] = [];

    if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
      rows = await this.repo.list();
    } else if (user.rol === "director") {
      const escuelaId = await this.getDirectorEscuelaId(user.id);
      rows = await this.repo.listByEscuela(escuelaId);
    } else {
      throw new Error("No tienes permisos para ver docentes.");
    }

    return this.mapRows(rows);
  }

  async assignEscuela(
    profesorId: string,
    escuelaId: string,
    user: { id: string; rol: string },
  ) {
    if (user.rol !== "equipo_padi" && user.rol !== "encargado_zona") {
      throw new Error("No tienes permisos para asignar docentes a colegios.");
    }

    const prisma = getPrisma();
    if (!prisma) throw new Error("DB no disponible para asignar docente");
    const prismaAny = prisma as any;

    const [profesor, escuela] = await Promise.all([
      prismaAny.profesores.findUnique({
        where: { id: profesorId },
        select: { id: true },
      }),
      prismaAny.escuelas.findUnique({
        where: { id: escuelaId },
        select: { id: true },
      }),
    ]);

    if (!profesor) throw new Error("Docente no encontrado.");
    if (!escuela) throw new Error("Colegio no encontrado.");

    return this.repo.addEscuela(profesorId, escuelaId);
  }

  async unassignEscuela(
    profesorId: string,
    escuelaId: string,
    user: { id: string; rol: string },
  ) {
    if (user.rol !== "equipo_padi" && user.rol !== "encargado_zona") {
      throw new Error("No tienes permisos para desasignar docentes de colegios.");
    }

    return this.repo.removeEscuela(profesorId, escuelaId);
  }
}
