/** Aula activa de un alumno, con lo mínimo para decidir a cuál pertenece una evaluación. */
export interface AulaActiva {
  id: string;
  sala_id: number;
}

/**
 * Decide el aula de una evaluación cuando el pedido de alta no la trae (ADR-0021).
 *
 * - Una sola aula activa: esa (aunque sea de otra sala: es donde está el alumno).
 * - Varias: la única que es de la sala de la evaluación.
 * - Ninguna, o varias sin una única coincidencia: `undefined` (la evaluación queda sin aula;
 *   no se adivina).
 *
 * Es la misma regla con la que se completaron las evaluaciones sin aula el 24/11/2026
 * (`scripts/sql/2026-11-24-asignar-aula-evaluaciones*.sql`).
 */
export function elegirAulaDeEvaluacion(aulasActivas: AulaActiva[], salaId: number): string | undefined {
  const porId = new Map(aulasActivas.map((a) => [a.id, a]));
  const aulas = [...porId.values()];
  if (aulas.length === 1) return aulas[0].id;
  const deLaSala = aulas.filter((a) => a.sala_id === salaId);
  return deLaSala.length === 1 ? deLaSala[0].id : undefined;
}
