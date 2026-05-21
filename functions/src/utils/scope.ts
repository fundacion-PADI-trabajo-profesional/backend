import { getPrisma } from "../config/prismaClient";

/**
 * Retorna el zona_id del encargado de zona autenticado.
 *
 * @param userId - UUID del usuario con rol `"encargado_zona"`.
 * @throws Error si DB no está disponible o el encargado no tiene zona asignada.
 */
export async function getEncargadoZonaId(userId: string): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB no disponible");
  const encargado = await (prisma as any).encargados.findUnique({
    where: { usuario_id: userId },
    select: { zona_id: true },
  });
  if (!encargado?.zona_id) throw new Error("Encargado sin zona asignada");
  return encargado.zona_id;
}

/**
 * Retorna los IDs de escuelas con asignación activa para un docente.
 *
 * @param userId - UUID del usuario con rol `"docente"`.
 * @returns Array de `escuela_id` donde el docente tiene `fecha_fin: null`.
 *          Array vacío si no tiene asignaciones activas.
 */
export async function getDocenteEscuelas(userId: string): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB no disponible");
  const persona = await (prisma as any).personas.findUnique({
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
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB no disponible");
  const escuela = await (prisma as any).escuelas.findUnique({
    where: { id: escuelaId },
    select: { zona_id: true },
  });
  return escuela?.zona_id === zonaId;
}
