import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();
afterEach(() => vi.restoreAllMocks());

describe("GET /directivos", () => {
  it("equipo_padi lists directivos (repository chain runs)", async () => {
    // prismaMock.usuarioPerfil.findMany already returns [] — no spy needed
    mockAuthAs("equipo_padi");
    const res = await request(app).get("/directivos").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("encargado_zona gets 403 (C9 fix — solo PADI)", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app).get("/directivos").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("docente gets 403 (requireRole blocks)", async () => {
    mockAuthAs("docente");
    const res = await request(app).get("/directivos").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("GET /directivos/disponibles", () => {
  it("equipo_padi lists available directivos", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    // Override findMany to return specific data
    prismaMock.usuarioPerfil.findMany = vi.fn().mockResolvedValue([
      { id: "dir-1", nombre: "Juan", apellido: "Perez", escuela: null },
    ]);
    const res = await request(app).get("/directivos/disponibles").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("director gets 403 (requireRole blocks)", async () => {
    mockAuthAs("director");
    const res = await request(app).get("/directivos/disponibles").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("POST /directivos/:id/asignar-escuela", () => {
  it("returns 400 when escuela_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/directivos/dir-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({});  // missing escuela_id
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("equipo_padi assigns escuela to directivo", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi", "test-user-id");
    // Mock: escuela exists
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ id: "esc-1", zona: "norte" }),
    };
    // Differentiate: auth middleware calls findUnique with the logged-in user's ID ("test-user-id"),
    // the service calls it with the director's ID ("dir-1"). Return the correct role for each.
    prismaMock.usuarioPerfil.findUnique = vi.fn().mockImplementation(({ where }: any) => {
      if (where.id === "test-user-id") return { id: "test-user-id", rol: "equipo_padi", escuela_id: null };
      return { id: where.id, rol: "director" };
    });
    const res = await request(app)
      .post("/directivos/dir-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-1" });
    expect(res.status).toBe(200);
    expect(prismaMock.usuarioPerfil.update).toHaveBeenCalled();
  });

  it("returns 400 when escuela not found", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue(null), // escuela no existe
    };
    const res = await request(app)
      .post("/directivos/dir-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-99" });
    expect(res.status).toBe(400);
  });
});