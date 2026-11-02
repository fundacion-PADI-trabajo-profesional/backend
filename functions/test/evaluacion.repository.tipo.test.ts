import { describe, it, expect, vi, beforeEach } from "vitest";

// Prisma falso: registra qué se le pide. El filtro real lo aplica la base; acá se verifica
// que el repositorio pida exactamente alumno + sala + tipo + ventana del año (y excluya el id).
const { tx, llamadas } = vi.hoisted(() => {
  const llamadas: { findFirst: unknown[]; update: unknown[] } = { findFirst: [], update: [] };
  const tx = {
    evaluacionEstudiante: {
      findFirst: async (args: unknown) => {
        llamadas.findFirst.push(args);
        return { id: "ev-prev", tipo_id: "inicial", fecha_creacion: new Date("2026-03-12T00:00:00Z") };
      },
      update: async (args: unknown) => {
        llamadas.update.push(args);
        return { id: "ev-1" };
      },
    },
  };
  return { tx, llamadas };
});

vi.mock("../src/config/prismaClient", () => ({
  withRLSContext: async (fn: (t: unknown) => unknown) => fn(tx),
  withRLSContextAsAdmin: async (fn: (t: unknown) => unknown) => fn(tx),
  getPrisma: () => tx,
}));

import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";

beforeEach(() => {
  llamadas.findFirst.length = 0;
  llamadas.update.length = 0;
});

describe("EvaluacionRepository.findDuplicadoTipo", () => {
  it("filtra por alumno, sala, tipo y año (UTC), excluyendo la propia evaluación", async () => {
    const res = await EvaluacionRepository.findDuplicadoTipo({
      estudianteId: "s1", salaId: 4, tipoId: "inicial", anio: 2026, excluirId: "ev-1",
    });
    expect(res).toEqual({ id: "ev-prev", tipo_id: "inicial", fecha_creacion: new Date("2026-03-12T00:00:00Z") });
    expect(llamadas.findFirst).toHaveLength(1);
    expect(llamadas.findFirst[0]).toEqual({
      where: {
        estudiante_id: "s1",
        sala_id: 4,
        tipo_id: "inicial",
        fecha_creacion: { gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") },
        id: { not: "ev-1" },
      },
      orderBy: { fecha_creacion: "asc" },
      select: { id: true, tipo_id: true, fecha_creacion: true },
    });
  });

  it("sin excluirId no filtra por id", async () => {
    await EvaluacionRepository.findDuplicadoTipo({ estudianteId: "s1", salaId: 4, tipoId: "cierre", anio: 2026 });
    const args = llamadas.findFirst[0] as { where: Record<string, unknown> };
    expect(args.where).not.toHaveProperty("id");
    expect(args.where.tipo_id).toBe("cierre");
  });
});

describe("EvaluacionRepository.updateTipo", () => {
  it("actualiza solo tipo_id de la evaluación indicada", async () => {
    await EvaluacionRepository.updateTipo("ev-1", "cierre");
    expect(llamadas.update).toEqual([{ where: { id: "ev-1" }, data: { tipo_id: "cierre" } }]);
  });
});
