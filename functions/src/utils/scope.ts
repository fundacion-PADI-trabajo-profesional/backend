import { withRLSContext } from "../config/prismaClient";
import { AuthorizationError } from "./errors";

/**
 * Retorna el zona_id del encargado de zona autenticado.
 *
 * @param userId - UUID del usuario con rol `"encargado_zona"`.
 * @throws Error si DB no está disponible o el encargado no tiene zona asignada.
 */
export async function getEncargadoZonaId(userId: string): Promise<string> {
  return withRLSContext(async (tx) => {
    const encargado = await tx.encargados.findUnique({
      where: { usuario_id: userId },
      select: { zona_id: true },
    });
    if (!encargado?.zona_id) throw new AuthorizationError("Encargado sin zona asignada");
    return encargado.zona_id;
  });
}

/**
 * Retorna los IDs de escuelas con asignación activa para un docente.
 *
 * @param userId - UUID del usuario con rol `"docente"`.
 * @returns Array de `escuela_id` donde el docente tiene `fecha_fin: null`.
 *          Array vacío si no tiene asignaciones activas.
 */
export async function getDocenteEscuelas(userId: string): Promise<string[]> {
  return withRLSContext(async (tx) => {
    const persona = await tx.personas.findUnique({
      where: { usuario_id: userId },
      select: {
        profesores: {
          take: 1,
          select: {
            profesores_escuelas: {
              where: { fecha_fin: null },
              select: { escuela_id: true },
            },
          },
        },
      },
    });
    const profesor = persona?.profesores?.[0];
    if (!profesor) return [];
    return profesor.profesores_escuelas.map((pe: any) => pe.escuela_id);
  });
}

/**
 * Verifica si una escuela pertenece a una zona determinada.
 *
 * @param escuelaId - UUID de la escuela.
 * @param zonaId - UUID de la zona a comparar.
 * @returns `true` si la escuela tiene ese `zona_id`; `false` si no existe o no coincide.
 */
export async function escuelaPerteneceAZona(
  escuelaId: string,
  zonaId: string,
): Promise<boolean> {
  return withRLSContext(async (tx) => {
    const escuela = await tx.escuelas.findUnique({
      where: { id: escuelaId },
      select: { zona_id: true },
    });
    return escuela?.zona_id === zonaId;
  });
}

/**
 * Retorna el escuela_id del aula dado su id.
 *
 * @param aulaId - UUID del aula.
 * @returns El escuela_id si el aula existe, null si no.
 */
export async function getEscuelaDeAula(aulaId: string): Promise<string | null> {
  return withRLSContext(async (tx) => {
    const aula = await tx.aulas.findUnique({
      where: { id: aulaId },
      select: { escuela_id: true },
    });
    return aula?.escuela_id ?? null;
  });
}
