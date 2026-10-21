import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prisma falso con una sola área (CL de sala 5) y una pauta de tres partes
 * (Intrusos, numero 5) más una simple. El falso respeta el `select` que recibe,
 * así un campo que falte en el select del repositorio (por ejemplo
 * `minimo_aprobacion`) no llega al cálculo, igual que en la base real.
 */
const { tx, estado, cambios } = vi.hoisted(() => {
  const estado = { minimo: null as number | null, filas: [] as { pregunta_id: string; respuesta: number | null }[] };
  const cambios: { area: unknown[]; evaluacion: unknown[] } = { area: [], evaluacion: [] };
  const seleccionar = (fila: Record<string, unknown>, select?: Record<string, unknown>) =>
    select ? Object.fromEntries(Object.entries(fila).filter(([k]) => select[k])) : fila;
  const catalogo = () => ["s1", "i1", "i2", "i3"].map((id) => ({
    id, area_id: "CL", numero: id === "s1" ? 1 : 5, activa: true, puntaje: 1, puntaje_invertido: false,
    minimo_aprobacion: id === "s1" ? null : estado.minimo,
  }));
  const filas = () => estado.filas.map((f, i) => ({ id: `r${i}`, ...f }));
  const tx = {
    evaluacionEstudiante: {
      findUnique: async (args: any) => ({
        id: "ev-1", sala_id: 5, estudiante_id: "est-1", estado_id: "E",
        evaluaciones_estudiante_area: [{
          id: "area-1", area_id: "CL", estado_id: "E",
          evaluaciones_estudiante_area_preguntas: filas().map((f) => {
            const sel = args?.include?.evaluaciones_estudiante_area?.include?.evaluaciones_estudiante_area_preguntas?.include?.preguntas?.select;
            const preg = catalogo().find((p) => p.id === f.pregunta_id)!;
            return { ...f, preguntas: seleccionar(preg, sel) };
          }),
        }],
      }),
      update: async (args: unknown) => { cambios.evaluacion.push(args); return {}; },
    },
    estudiantes: { findUnique: async () => ({ fecha_baja: null }) },
    evaluacionesEstudianteArea: {
      findFirst: async () => ({ id: "area-1" }),
      update: async (args: unknown) => { cambios.area.push(args); return {}; },
      findMany: async () => [{ estado_id: (cambios.area[0] as any)?.data?.estado_id ?? "E" }],
    },
    evaluacionesEstudianteAreaPreguntas: {
      findFirst: async () => ({ id: "r0" }),
      update: async () => ({}),
      create: async () => ({}),
      findMany: async (args: any) => filas().map((f) => seleccionar(f, args?.select)),
    },
    preguntas: { findMany: async (args: any) => catalogo().map((p) => seleccionar(p, args?.select)) },
    reglasAprobacion: { findFirst: async () => ({ aprueba_con: 2, puntaje_total: 2 }) },
  };
  return { tx, estado, cambios };
});

vi.mock("../src/config/prismaClient", () => ({
  withRLSContext: async (fn: (t: unknown) => unknown) => fn(tx),
  withRLSContextAsAdmin: async (fn: (t: unknown) => unknown) => fn(tx),
  getPrisma: () => tx,
}));

import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";

const COMPLETAS_2_DE_3 = [
  { pregunta_id: "s1", respuesta: 1 }, { pregunta_id: "i1", respuesta: 1 }, { pregunta_id: "i2", respuesta: 1 }, { pregunta_id: "i3", respuesta: 0 },
];

beforeEach(() => { cambios.area.length = 0; cambios.evaluacion.length = 0; estado.minimo = null; estado.filas = COMPLETAS_2_DE_3; });

describe("calculateAreaScore (vía saveRespuestas)", () => {
  it("sin mínimo cargado, 2 de 3 aprueba la pauta y el área (2 puntos de 2)", async () => {
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", [{ id: "i3", answer: 0 }]);
    expect(r.area).toMatchObject({ estado: "A", puntaje: 2, aciertosIndividuales: 2, totalPreguntas: 2 });
    expect(cambios.area[0]).toMatchObject({ data: { estado_id: "A", puntaje: 2 } });
    expect(cambios.evaluacion[0]).toMatchObject({ data: { estado_id: "A" } });
  });

  it("con mínimo 3, 2 de 3 no aprueba la pauta: el área queda desaprobada con 1 punto", async () => {
    estado.minimo = 3;
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", [{ id: "i3", answer: 0 }]);
    expect(r.area).toMatchObject({ estado: "D", puntaje: 1, aciertosIndividuales: 1, totalPreguntas: 2 });
    expect(cambios.area[0]).toMatchObject({ data: { estado_id: "D", puntaje: 1 } });
    expect(cambios.evaluacion[0]).toMatchObject({ data: { estado_id: "D" } });
  });

  it("una parte sin fila de respuesta deja la pauta incompleta y el área en progreso, aunque las otras estén bien", async () => {
    estado.filas = [{ pregunta_id: "s1", respuesta: 1 }, { pregunta_id: "i1", respuesta: 1 }, { pregunta_id: "i2", respuesta: 1 }];
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", [{ id: "i2", answer: 1 }]);
    expect(r.area).toMatchObject({ estado: "E", totalPreguntas: 2 });
    expect(cambios.area[0]).toMatchObject({ data: { estado_id: "E" } });
  });

  it("sin ninguna respuesta, el área queda en progreso con 0", async () => {
    estado.filas = [];
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", []);
    expect(r.area).toMatchObject({ estado: "E", puntaje: 0, aciertosIndividuales: 0, totalPreguntas: 2 });
  });
});

describe("findById", () => {
  it("los aciertos por área usan el mínimo de la pauta y cuentan las pautas desde el catálogo", async () => {
    estado.minimo = 3;
    const conMinimo = await EvaluacionRepository.findById("ev-1");
    expect(conMinimo.evaluaciones_estudiante_area[0]).toMatchObject({ aciertos_individuales: 1, totalPreguntas: 2, puntajeFinal: 1, gruposRespondidos: 2 });

    estado.minimo = null;
    const sinMinimo = await EvaluacionRepository.findById("ev-1");
    expect(sinMinimo.evaluaciones_estudiante_area[0]).toMatchObject({ aciertos_individuales: 2, puntajeFinal: 2 });
  });

  it("una pauta con una parte sin fila no cuenta como respondida", async () => {
    estado.filas = [{ pregunta_id: "s1", respuesta: 1 }, { pregunta_id: "i1", respuesta: 1 }];
    const r = await EvaluacionRepository.findById("ev-1");
    expect(r.evaluaciones_estudiante_area[0]).toMatchObject({ totalPreguntas: 2, gruposRespondidos: 1 });
  });
});
