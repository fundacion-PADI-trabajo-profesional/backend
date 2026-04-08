import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as evaluacionRepo from "../src/repositories/evaluacion.repository";
import { mockAuthAs } from "./helpers/auth-mock"; // Importamos el helper

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("evaluaciones catálogo", () => {
  it("GET /evaluaciones returns 200 and list", async () => {
    // Simulamos un usuario de PADI para ver todas las evaluaciones
    mockAuthAs("equipo_padi");

    const mockList = [{ id: "ev1", titulo: "Eval 1" }];
    const spy = vi.spyOn(evaluacionRepo.EvaluacionRepository, "listWithFilters").mockResolvedValue(mockList as any);

    const res = await request(app)
      .get("/evaluaciones")
      .set("Authorization", "Bearer fake-token"); // Header requerido

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("GET /evaluaciones/:id returns 200 when found", async () => {
    mockAuthAs("equipo_padi");

    const mockItem = { id: "ev1", titulo: "Eval 1" };
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue(mockItem as any);

    const res = await request(app)
      .get("/evaluaciones/ev1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("ev1");
  });

  it("GET /evaluaciones/:id returns 404 when not found", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue(null);

    const res = await request(app)
      .get("/evaluaciones/does-not-exist")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(404);
  });
});