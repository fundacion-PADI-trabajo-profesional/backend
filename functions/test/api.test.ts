import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { HealthService } from "../src/services/health.service";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

describe("health endpoint", () => {
  it("returns ok:true", async () => {
    // El health check llama a la BD — lo mockeamos para no necesitar conexión real
    vi.spyOn(HealthService.prototype, "getHealth").mockResolvedValue(undefined as any);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe("directivos assign escuela endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encargado_zona gets 403 on POST /directivos/:id/asignar-escuela (C9 fix — solo PADI)", async () => {
    // Tras la fix C9, POST /directivos/:id/asignar-escuela requiere equipo_padi.
    // encargado_zona ya no puede asignar escuelas a directivos directamente.
    mockAuthAs("encargado_zona", "encargado-user-1");

    const res = await request(app)
      .post("/directivos/dir1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc1" });

    expect(res.status).toBe(403);
  });

  it("equipo_padi can assign escuela to director", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi", "padi-user-1");

    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ id: "esc1", zona: "Norte" }),
    };
    const originalFindUnique = prismaMock.usuarioPerfil.findUnique;
    prismaMock.usuarioPerfil.findUnique = vi.fn().mockImplementation(async (args: any) => {
      if (args && args.where && args.where.id === "dir1") {
        return { id: "dir1", rol: "director" };
      }
      return originalFindUnique(args);
    });

    const res = await request(app)
      .post("/directivos/dir1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc1" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(prismaMock.usuarioPerfil.update).toHaveBeenCalled();
  });
});

describe("evaluaciones endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty list", async () => {
    mockAuthAs("equipo_padi"); // Necesita estar logueado

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([]);

    const res = await request(app)
      .get("/evaluaciones")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
  });

  it("returns 404 when not found", async () => {
    mockAuthAs("equipo_padi");

    vi.spyOn(EvaluacionRepository, "findById").mockResolvedValue(null);

    const res = await request(app)
      .get("/evaluaciones/does-not-exist")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(404);
  });
});

describe("zonas encargados endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows equipo_padi to list encargados for zone assignment", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");

    prismaMock.encargados = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "enc-1",
          usuario: { nombre: "Ana" },
        },
      ]),
    };

    const res = await request(app)
      .get("/zonas/encargados") // Ya no enviamos ?rol=...
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("rejects non equipo_padi roles", async () => {
    // Mockeamos como un rol que NO tiene permiso para esta ruta
    mockAuthAs("encargado_zona");

    const res = await request(app)
      .get("/zonas/encargados")
      .set("Authorization", "Bearer fake-token");

    // Ahora el middleware requireRole debería devolver 403 automáticamente
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("message");
  });
});
