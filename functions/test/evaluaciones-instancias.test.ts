import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { EvaluacionService } from "../src/services/evaluaciones.service";

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
    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue(baseMock as any);

    const res = await request(app).get("/evaluaciones");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it("GET /evaluaciones filters by estudianteId", async () => {
    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([
      baseMock[0],
    ] as any);

    const res = await request(app).get("/evaluaciones?estudianteId=s1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].estudiante_id).toBe("s1");
  });

  it("GET /evaluaciones filters by profesorId", async () => {
    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([
      baseMock[1],
    ] as any);

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

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([
      extendedMock[2],
    ] as any);

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

  it("POST /evaluaciones guarda aula_id cuando viene en payload", async () => {
    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({
      id: "s1",
      sala_id: 1,
    } as any);
    vi.spyOn(EvaluacionRepository, "findActiveEstudianteAula").mockResolvedValue({
      aula: { id: "a1", sala_id: 3, escuela_id: "esc1" },
    } as any);
    const createSpy = vi.spyOn(EvaluacionRepository, "create").mockResolvedValue({
      id: "e100",
      estudiante_id: "s1",
      profesor_id: "p1",
      sala_id: 3,
      aula_id: "a1",
      tipo_id: "inicial",
      estado_id: "N",
      fecha_creacion: new Date(),
    } as any);

    const res = await request(app)
      .post("/evaluaciones")
      .send({
        dni: "44111222",
        profesor_id: "00000000-0000-0000-0000-000000000001",
        tipo_id: "inicial",
        fecha_creacion: "2026-02",
        aula_id: "a1",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        estudiante_id: "s1",
        aula_id: "a1",
        sala_id: 3,
      }),
    );
  });

  it("POST /evaluaciones devuelve 400 si estudiante no está activo en el aula indicada", async () => {
    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({
      id: "s1",
      sala_id: 1,
    } as any);
    vi.spyOn(EvaluacionRepository, "findActiveEstudianteAula").mockResolvedValue(null as any);

    const res = await request(app)
      .post("/evaluaciones")
      .send({
        dni: "44111222",
        profesor_id: "00000000-0000-0000-0000-000000000001",
        tipo_id: "inicial",
        fecha_creacion: "2026-02",
        aula_id: "aula-invalida",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
    expect(String(res.body.message || "")).toContain("no está asignado activamente al aula");
  });

  it("DELETE /evaluaciones/:id permite eliminar para equipo_padi", async () => {
    const deleteSpy = vi.spyOn(EvaluacionRepository, "delete").mockResolvedValue({ id: "e1" } as any);

    const res = await request(app).delete("/evaluaciones/e1?usuario_id=padi-1&rol=equipo_padi");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(deleteSpy).toHaveBeenCalledWith("e1");
  });

  it("DELETE /evaluaciones/:id devuelve 400 si faltan usuario_id y rol", async () => {
    const res = await request(app).delete("/evaluaciones/e1");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });
}); 