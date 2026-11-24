import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prisma falso: catálogo de sala 4 con dos áreas. CL tiene una pauta simple (numero 1) y una de
 * dos partes (numero 2); SE tiene dos pautas simples y una inactiva que no cuenta.
 */
const { tx, estado } = vi.hoisted(() => {
  const estado = { respuestas: [] as { evaluaciones_area_id: string; pregunta_id: string; respuesta: number | null }[] };
  const catalogo = [
    { id: "c1", sala_id: 4, area_id: "CL", numero: 1, activa: true },
    { id: "c2a", sala_id: 4, area_id: "CL", numero: 2, activa: true },
    { id: "c2b", sala_id: 4, area_id: "CL", numero: 2, activa: null },
    { id: "s1", sala_id: 4, area_id: "SE", numero: 1, activa: true },
    { id: "s2", sala_id: 4, area_id: "SE", numero: 2, activa: true },
    { id: "s3", sala_id: 4, area_id: "SE", numero: 3, activa: false },
    { id: "otra", sala_id: 5, area_id: "CL", numero: 1, activa: true },
  ];
  const tx = {
    preguntas: {
      findMany: async (args: any) =>
        catalogo.filter((p) => args.where.sala_id.in.includes(p.sala_id) && p.activa !== false),
    },
    evaluacionesEstudianteAreaPreguntas: {
      findMany: async (args: any) =>
        estado.respuestas.filter((r) => args.where.evaluaciones_area_id.in.includes(r.evaluaciones_area_id)),
    },
  };
  return { tx, estado };
});

vi.mock("../src/config/prismaClient", () => ({
  withRLSContext: async (fn: (t: unknown) => unknown) => fn(tx),
  withRLSContextAsAdmin: async (fn: (t: unknown) => unknown) => fn(tx),
  getPrisma: () => tx,
}));

import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { EvaluacionService } from "../src/services/evaluaciones.service";
import { avanceDeArea } from "../src/utils/pautas";

function evaluacion() {
  return {
    id: "ev-1", sala_id: 4,
    evaluaciones_estudiante_area: [
      { id: "a-cl", area_id: "CL", estado_id: "E" },
      { id: "a-se", area_id: "SE", estado_id: "N" },
    ],
  } as any;
}

beforeEach(() => {
  estado.respuestas = [];
  vi.restoreAllMocks();
});

describe("avanceDeArea", () => {
  const partes = [{ id: "p1", numero: 1 }, { id: "p2a", numero: 2 }, { id: "p2b", numero: 2 }];

  it("cuenta pautas, no partes", () => {
    expect(avanceDeArea(partes, new Map())).toEqual({ totalPautas: 2, pautasRespondidas: 0 });
  });

  it("una pauta de varias partes cuenta como respondida recién con todas sus partes", () => {
    expect(avanceDeArea(partes, new Map([["p1", 1], ["p2a", 0]]))).toEqual({ totalPautas: 2, pautasRespondidas: 1 });
    expect(avanceDeArea(partes, new Map([["p1", 1], ["p2a", 0], ["p2b", 1]]))).toEqual({ totalPautas: 2, pautasRespondidas: 2 });
  });

  it("una respuesta en null no cuenta como respondida", () => {
    expect(avanceDeArea(partes, new Map([["p1", null]]))).toEqual({ totalPautas: 2, pautasRespondidas: 0 });
  });
});

describe("EvaluacionRepository.agregarAvancePorArea", () => {
  it("agrega a cada área el total de pautas activas de su sala y cuántas están respondidas", async () => {
    estado.respuestas = [
      { evaluaciones_area_id: "a-cl", pregunta_id: "c1", respuesta: 1 },
      { evaluaciones_area_id: "a-cl", pregunta_id: "c2a", respuesta: 0 },
    ];
    const [ev] = await EvaluacionRepository.agregarAvancePorArea([evaluacion()]);

    const [cl, se] = ev.evaluaciones_estudiante_area;
    expect(cl).toMatchObject({ totalPreguntas: 2, gruposRespondidos: 1 });
    expect(se).toMatchObject({ totalPreguntas: 2, gruposRespondidos: 0 });
  });

  it("no mezcla respuestas de otra evaluación del mismo alumno", async () => {
    estado.respuestas = [{ evaluaciones_area_id: "area-de-otra", pregunta_id: "c1", respuesta: 1 }];
    const [ev] = await EvaluacionRepository.agregarAvancePorArea([evaluacion()]);
    expect(ev.evaluaciones_estudiante_area[0].gruposRespondidos).toBe(0);
  });

  it("con una lista vacía no consulta nada", async () => {
    const spy = vi.spyOn(tx.preguntas, "findMany");
    expect(await EvaluacionRepository.agregarAvancePorArea([])).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("EvaluacionService.listWithFilters", () => {
  it("el historial de un alumno (estudianteId) trae el avance por área", async () => {
    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([evaluacion()] as any);
    const avance = vi.spyOn(EvaluacionRepository, "agregarAvancePorArea");

    const res: any = await new EvaluacionService().listWithFilters({ estudianteId: "est-1" });

    expect(avance).toHaveBeenCalledTimes(1);
    expect(res[0].evaluaciones_estudiante_area[0].totalPreguntas).toBe(2);
  });

  it("los listados generales no calculan el avance (serían cientos de evaluaciones)", async () => {
    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([evaluacion()] as any);
    const avance = vi.spyOn(EvaluacionRepository, "agregarAvancePorArea");

    await new EvaluacionService().listWithFilters({ escuelaId: "esc-1" });

    expect(avance).not.toHaveBeenCalled();
  });
});
