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
      estudianteId: "s1",
      salaId: 1,
      tipoId: "diagnostico",
      estadoId: "N",
      puntaje: null,
      createdAt: new Date(),
    },
  ]);
  
  vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "getInstanciaById").mockResolvedValue(null);
  
  vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "createInstancia").mockImplementation(async (input: any) => ({
    id: "new-id",
    createdAt: new Date(),
    ...input,
  }));
});

describe("evaluaciones instancias", () => {
  it("GET /evaluaciones-instancias returns list", async () => {
    const res = await request(app).get("/evaluaciones-instancias");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
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


