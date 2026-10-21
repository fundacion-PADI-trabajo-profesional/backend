import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prisma falso con una sola pauta en el área: Intrusos de sala 5, tres partes,
 * respondidas Sí, Sí, No. Con `minimo_aprobacion = 3` la pauta no aprueba; sin
 * mínimo (null) aprueba con la mitad. La regla del área: 1 punto de 1.
 */
const { tx, estado, cambios } = vi.hoisted(() => {
  const estado = { minimo: null as number | null };
  const cambios: { area: unknown[]; evaluacion: unknown[] } = { area: [], evaluacion: [] };
  const pregunta = (id: string) => ({ id, numero: 5, activa: true, puntaje: 1, puntaje_invertido: false, minimo_aprobacion: estado.minimo });
  const respuestas = () => [
    { id: "r1", pregunta_id: "i1", respuesta: 1, preguntas: pregunta("i1") },
    { id: "r2", pregunta_id: "i2", respuesta: 1, preguntas: pregunta("i2") },
    { id: "r3", pregunta_id: "i3", respuesta: 0, preguntas: pregunta("i3") },
  ];
  const tx = {
    evaluacionEstudiante: {
      findUnique: async () => ({
        id: "ev-1", sala_id: 5, estudiante_id: "est-1", estado_id: "E",
        evaluaciones_estudiante_area: [{ id: "area-1", area_id: "CL", estado_id: "E", evaluaciones_estudiante_area_preguntas: respuestas() }],
      }),
      update: async (args: unknown) => { cambios.evaluacion.push(args); return {}; },
    },
    estudiantes: { findUnique: async () => ({ fecha_baja: null }) },
    evaluacionesEstudianteArea: {
      findFirst: async () => ({ id: "area-1" }),
      update: async (args: unknown) => { cambios.area.push(args); return {}; },
      findMany: async () => [{ estado_id: "A" }],
    },
    evaluacionesEstudianteAreaPreguntas: {
      findFirst: async () => ({ id: "r3" }),
      update: async () => ({}),
      create: async () => ({}),
      findMany: async () => respuestas(),
    },
    preguntas: { findMany: async () => [pregunta("i1"), pregunta("i2"), pregunta("i3")] },
    reglasAprobacion: { findFirst: async () => ({ aprueba_con: 1, puntaje_total: 1 }) },
  };
  return { tx, estado, cambios };
});

vi.mock("../src/config/prismaClient", () => ({
  withRLSContext: async (fn: (t: unknown) => unknown) => fn(tx),
  withRLSContextAsAdmin: async (fn: (t: unknown) => unknown) => fn(tx),
  getPrisma: () => tx,
}));

import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";

beforeEach(() => { cambios.area.length = 0; cambios.evaluacion.length = 0; });

describe("calculateAreaScore con minimo_aprobacion (vía saveRespuestas)", () => {
  it("sin mínimo cargado, 2 de 3 aprueba la pauta y el área", async () => {
    estado.minimo = null;
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", [{ id: "i3", answer: 0 }]);
    expect(r.area).toMatchObject({ estado: "A", puntaje: 1, aciertosIndividuales: 1, totalPreguntas: 1 });
    expect(cambios.area[0]).toMatchObject({ data: { estado_id: "A", puntaje: 1 } });
  });

  it("con mínimo 3, 2 de 3 no aprueba la pauta y el área queda desaprobada", async () => {
    estado.minimo = 3;
    const r = await EvaluacionRepository.saveRespuestas("ev-1", "CL", [{ id: "i3", answer: 0 }]);
    expect(r.area).toMatchObject({ estado: "D", puntaje: 0, aciertosIndividuales: 0, totalPreguntas: 1 });
    expect(cambios.area[0]).toMatchObject({ data: { estado_id: "D", puntaje: 0 } });
  });
});

describe("findById con minimo_aprobacion", () => {
  it("los aciertos por área usan el mínimo de la pauta", async () => {
    estado.minimo = 3;
    const conMinimo = await EvaluacionRepository.findById("ev-1");
    expect(conMinimo.evaluaciones_estudiante_area[0]).toMatchObject({ aciertos_individuales: 0, totalPreguntas: 1, puntajeFinal: 0 });

    estado.minimo = null;
    const sinMinimo = await EvaluacionRepository.findById("ev-1");
    expect(sinMinimo.evaluaciones_estudiante_area[0]).toMatchObject({ aciertos_individuales: 1, puntajeFinal: 1 });
  });
});
