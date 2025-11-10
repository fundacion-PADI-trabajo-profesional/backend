import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as evaluacionRepo from "../src/repositories/evaluacion.repository";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Mock the repository methods
  vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "listInstancias").mockResolvedValue([
    {
      id: "e1",
      estudiante_id: "s1",
      profesor_id: "p1",
      sala_id: 1,
      tipo_id: "diagnostico",
      estado_id: "N",
      puntaje: null,
      fecha_creacion: new Date(),
    },
  ]);
  
  vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "getInstanciaById").mockResolvedValue(null);
  
  vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "createInstancia").mockImplementation(async (input: any) => ({
    id: "new-id",
    estudiante_id: input.estudianteId,
    profesor_id: input.profesorId ?? "p1",
    sala_id: input.salaId,
    tipo_id: input.tipoId,
    estado_id: input.estadoId,
    puntaje: input.puntaje ?? null,
    fecha_creacion: new Date(),
  }));
});

describe("evaluaciones instancias", () => {
  it("GET /evaluaciones-instancias returns list", async () => {
    const res = await request(app).get("/evaluaciones-instancias");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /evaluaciones-instancias passes filters to repository", async () => {
    const spy = vi
      .spyOn(evaluacionRepo.EvaluacionRepository.prototype, "listInstancias")
      .mockResolvedValue([]);

    const res = await request(app).get(
      "/evaluaciones-instancias?estudianteId=s1&salaId=2&tipoId=diagnostico&estadoId=N&limit=10&offset=5",
    );
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      estudianteId: "s1",
      salaId: 2,
      tipoId: "diagnostico",
      estadoId: "N",
      limit: 10,
      offset: 5,
    });
  });

  it("GET /evaluaciones-instancias without filters still calls repo with undefineds", async () => {
    const spy = vi
      .spyOn(evaluacionRepo.EvaluacionRepository.prototype, "listInstancias")
      .mockResolvedValue([]);
    const res = await request(app).get("/evaluaciones-instancias");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({
      estudianteId: undefined,
      salaId: undefined,
      tipoId: undefined,
      estadoId: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it("GET /evaluaciones-instancias/:id returns 404 when missing", async () => {
    const res = await request(app).get("/evaluaciones-instancias/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });

  it("POST /evaluaciones-instancias creates one", async () => {
    const payload = {
      estudianteId: "s1",
      salaId: 1,
      tipoId: "diagnostico",
      estadoId: "N",
      puntaje: null,
    };
    const res = await request(app)
      .post("/evaluaciones-instancias")
      .send(payload)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data).toBeTruthy();
  });
});


