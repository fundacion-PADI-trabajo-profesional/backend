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

describe("evaluaciones - branches de rol y errores", () => {
  it("GET /evaluaciones as director without escuela returns 400", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: null });
    const res = await request(app).get("/evaluaciones").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("GET /evaluaciones as docente without filter returns 400", async () => {
    mockAuthAs("docente");
    const res = await request(app).get("/evaluaciones").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("GET /evaluaciones service throws returns 500", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "listWithFilters").mockRejectedValue(new Error("DB error"));
    const res = await request(app).get("/evaluaciones").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(500);
  });

  it("GET /evaluaciones/:id as docente viewing other's evaluation returns 403", async () => {
    mockAuthAs("docente", "docente-1");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "otro-docente",
    } as any);
    const res = await request(app).get("/evaluaciones/ev-1").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("GET /evaluaciones/:id as director for different school returns 403", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: "esc-mia" });
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "prof-1",
      estudiantes: { escuela_id: "esc-otra" },
    } as any);
    const res = await request(app).get("/evaluaciones/ev-1").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("DELETE /evaluaciones/:id returns 500 when evaluacion no existe", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue(null);
    const res = await request(app).delete("/evaluaciones/no-existe").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(500);
  });

  it("GET /evaluaciones/:id/areas/:areaId/preguntas returns 200", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "any-prof",
    } as any);
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "getPreguntasArea").mockResolvedValue({
      preguntas: [],
      respuestas: [],
      evaluacionAreaId: "ea-1",
    } as any);
    const res = await request(app)
      .get("/evaluaciones/ev-1/areas/area-1/preguntas")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });

  it("POST /evaluaciones/:id/respuestas returns 200", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "any-prof",
    } as any);
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "saveRespuestas").mockResolvedValue({} as any);
    const res = await request(app)
      .post("/evaluaciones/ev-1/respuestas")
      .set("Authorization", "Bearer fake-token")
      .send({ areaId: "area-1", questions: [] });
    expect(res.status).toBe(200);
  });

  it("GET /evaluaciones/:id/areas/:areaId/preguntas returns 403 for docente viewing other's eval (C3)", async () => {
    mockAuthAs("docente", "docente-1");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "otro-docente",
    } as any);
    const res = await request(app)
      .get("/evaluaciones/ev-1/areas/area-1/preguntas")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("POST /evaluaciones/:id/respuestas returns 403 for docente modifying other's eval (C3)", async () => {
    mockAuthAs("docente", "docente-1");
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      profesor_id: "otro-docente",
    } as any);
    const res = await request(app)
      .post("/evaluaciones/ev-1/respuestas")
      .set("Authorization", "Bearer fake-token")
      .send({ areaId: "area-1", questions: [] });
    expect(res.status).toBe(403);
  });
});

describe("evaluaciones - encargado_zona zone scoping", () => {
  it("GET /evaluaciones as encargado_zona without filter uses escuelaIds from zone", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: {
          escuelas: [{ id: "escuela-a" }, { id: "escuela-b" }],
        },
      }),
    };

    const spy = vi.spyOn(evaluacionRepo.EvaluacionRepository, "listWithFilters").mockResolvedValue([]);

    const res = await request(app)
      .get("/evaluaciones")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    // Debe incluir escuelaIds con las escuelas de la zona
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ escuelaIds: ["escuela-a", "escuela-b"] })
    );
  });

  it("GET /evaluaciones as encargado_zona with in-zone escuela_id is allowed", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: {
          escuelas: [{ id: "escuela-a" }, { id: "escuela-b" }],
        },
      }),
    };

    vi.spyOn(evaluacionRepo.EvaluacionRepository, "listWithFilters").mockResolvedValue([]);

    const res = await request(app)
      .get("/evaluaciones?escuela_id=escuela-a")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
  });

  it("GET /evaluaciones as encargado_zona with out-of-zone escuela_id returns 403", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: {
          escuelas: [{ id: "escuela-a" }, { id: "escuela-b" }],
        },
      }),
    };

    const res = await request(app)
      .get("/evaluaciones?escuela_id=escuela-otra-zona")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("GET /evaluaciones/:id as encargado_zona for out-of-zone student returns 403", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: {
          escuelas: [{ id: "escuela-a" }],
        },
      }),
    };

    // La evaluación pertenece a un estudiante de otra zona
    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-999",
      estudiantes: { escuela_id: "escuela-otra-zona" },
    } as any);

    const res = await request(app)
      .get("/evaluaciones/ev-999")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("GET /evaluaciones/:id as encargado_zona for in-zone student returns 200", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: {
          escuelas: [{ id: "escuela-a" }],
        },
      }),
    };

    vi.spyOn(evaluacionRepo.EvaluacionRepository, "findById").mockResolvedValue({
      id: "ev-1",
      estudiantes: { escuela_id: "escuela-a" },
    } as any);

    const res = await request(app)
      .get("/evaluaciones/ev-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
  });
});