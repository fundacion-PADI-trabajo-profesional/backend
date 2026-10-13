import { describe, it, expect, vi, afterEach } from "vitest";

// Prisma falso: registra qué se le pide y devuelve filas fijas. El orden real lo aplica la base;
// acá se verifica que el repositorio se lo pida con los tres criterios.
const { tx, llamadas } = vi.hoisted(() => {
  const llamadas: Record<string, unknown[]> = { findMany: [] };
  const tx = {
    evaluacionEstudiante: { findUnique: async () => ({ id: "ev-1", sala_id: 4 }) },
    evaluacionesEstudianteArea: { findFirst: async () => ({ id: "area-1" }) },
    preguntas: {
      findMany: async (args: unknown) => {
        llamadas.findMany.push(args);
        return [
          { id: "b", numero: 6, orden: 2, consigna: "Ropa", imagen_url: null },
          { id: "a", numero: 6, orden: 1, consigna: "Animal", imagen_url: null },
        ];
      },
    },
    evaluacionesEstudianteAreaPreguntas: { findMany: async () => [] },
  };
  return { tx, llamadas };
});

vi.mock("../src/config/prismaClient", () => ({
  withRLSContext: async (fn: (t: unknown) => unknown) => fn(tx),
  withRLSContextAsAdmin: async (fn: (t: unknown) => unknown) => fn(tx),
  getPrisma: () => tx,
}));

import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";

afterEach(() => { llamadas.findMany.length = 0; });

describe("EvaluacionRepository.getPreguntasArea", () => {
  it("pide las preguntas ordenadas por numero, luego orden de la parte y por último id", async () => {
    await EvaluacionRepository.getPreguntasArea("ev-1", "CL");
    expect(llamadas.findMany).toHaveLength(1);
    const args = llamadas.findMany[0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([{ numero: "asc" }, { orden: "asc" }, { id: "asc" }]);
  });

  it("devuelve las preguntas tal como vienen de la base, con el campo orden", async () => {
    const { preguntas } = await EvaluacionRepository.getPreguntasArea("ev-1", "CL");
    expect(preguntas.map((p: { id: string; orden?: number | null }) => [p.id, p.orden])).toEqual([["b", 2], ["a", 1]]);
  });
});
