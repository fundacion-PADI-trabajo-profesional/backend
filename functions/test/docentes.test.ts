import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { DocenteRepository } from "../src/repositories/docente.repository";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("docentes endpoints", () => {
  it("GET /docentes returns 200 and list of docentes", async () => {
    const mock = [
      {
        id: "u1",
        personas: { nombre: "Ana", primer_apellido: "Pérez" },
      },
      {
        id: "u2",
        personas: { nombre: "Bruno", primer_apellido: "García" },
      },
    ];
    const spy = vi.spyOn(DocenteRepository, "list").mockResolvedValue(mock);
    const res = await request(app).get("/docentes");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});


