import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

// Estos tests validan el comportamiento de las "instancias de evaluación"
// usando la API actual basada en /evaluaciones y filtros por query params.

describe("evaluaciones instancias (API /evaluaciones)", () => {
  const baseMock = [
    {
      id: "e1",
      estudiante_id: "s1",
      profesor_id: "p1",
      sala_id: 1,
      tipo_id: "inicial",
      estado_id: "N",
      puntaje: null,
      fecha_creacion: new Date(),
    },
    {
      id: "e2",
      estudiante_id: "s2",
      profesor_id: "p2",
      sala_id: 2,
      tipo_id: "cierre",
      estado_id: "C",
      puntaje: 10,
      fecha_creacion: new Date(),
    },
  ];

  it("GET /evaluaciones returns full list of evaluaciones", async () => {
    vi.spyOn(EvaluacionRepository, "list").mockResolvedValue(baseMock as any);

    const res = await request(app).get("/evaluaciones");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it("GET /evaluaciones filters by estudianteId", async () => {
    vi.spyOn(EvaluacionRepository, "list").mockResolvedValue(baseMock as any);

    const res = await request(app).get("/evaluaciones?estudianteId=s1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].estudiante_id).toBe("s1");
  });

  it("GET /evaluaciones filters by profesorId", async () => {
    vi.spyOn(EvaluacionRepository, "list").mockResolvedValue(baseMock as any);

    const res = await request(app).get("/evaluaciones?profesorId=p2");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].profesor_id).toBe("p2");
  });

  it("GET /evaluaciones can combine multiple filters", async () => {
    const extendedMock = [
      ...baseMock,
      {
        id: "e3",
        estudiante_id: "s1",
        profesor_id: "p2",
        sala_id: 1,
        tipo_id: "inicial",
        estado_id: "N",
        puntaje: null,
        fecha_creacion: new Date(),
      },
    ];

    vi.spyOn(EvaluacionRepository, "list").mockResolvedValue(extendedMock as any);

    const res = await request(app).get("/evaluaciones?estudianteId=s1&profesorId=p2");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: "e3",
      estudiante_id: "s1",
      profesor_id: "p2",
    });
  });
}); 