import { withRLSContext } from "../config/prismaClient";

/** Lo que el helper necesita del usuario autenticado (`req.user`). */
export interface UsuarioAlcance {
  id: string;
  rol: string;
  escuela_id?: string | null;
}

/**
 * ¿La escuela de una evaluación está dentro del alcance del usuario? (ADR 0015)
 *
 * - Director: su propia escuela. Si no tiene `escuela_id` asignada o la escuela de la
 *   evaluación es desconocida, se deja pasar (comportamiento histórico de la lectura).
 * - Encargado de zona: las escuelas de su zona. Escuela desconocida → se deja pasar.
 * - Equipo PADI y docente: `true` (la docente se controla por autoría/aula en cada endpoint).
 *
 * Reemplaza los bloques que estaban copiados en varios controllers de evaluaciones.
 */
export async function escuelaEnAlcance(user: UsuarioAlcance, escuelaId: string | null | undefined): Promise<boolean> {
  if (!escuelaId) return true;

  if (user.rol === "director") {
    return !user.escuela_id || user.escuela_id === escuelaId;
  }

  if (user.rol === "encargado_zona") {
    const encargado = await withRLSContext(async (tx) => {
      return tx.encargados.findUnique({
        where: { usuario_id: user.id },
        include: { zona: { include: { escuelas: { select: { id: true } } } } },
      });
    });
    const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];
    return escuelasDeZona.includes(escuelaId);
  }

  return true;
}
