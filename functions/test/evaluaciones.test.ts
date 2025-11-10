import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as evaluacionRepo from "../src/repositories/evaluacion.repository";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("evaluaciones catálogo", () => {
  it("GET /evaluaciones returns 200 and list", async () => {
    const mockList = [
      { id: "ev1", titulo: "Eval 1" },
      { id: "ev2", titulo: "Eval 2" },
    ];
    const spy = vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "list").mockResolvedValue(mockList as any);
    const res = await request(app).get("/evaluaciones");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("GET /evaluaciones/:id returns 200 when found", async () => {
    const mockItem = { id: "ev1", titulo: "Eval 1" };
    const spy = vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "getById").mockResolvedValue(mockItem as any);
    const res = await request(app).get("/evaluaciones/ev1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.id).toBe("ev1");
    expect(spy).toHaveBeenCalledWith("ev1");
  });

  it("GET /evaluaciones/:id returns 404 when not found", async () => {
    vi.spyOn(evaluacionRepo.EvaluacionRepository.prototype, "getById").mockResolvedValue(null);
    const res = await request(app).get("/evaluaciones/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});


