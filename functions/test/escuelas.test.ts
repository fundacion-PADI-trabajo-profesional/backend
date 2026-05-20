import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EscuelasRepository } from "../src/repositories/escuela.repository";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

afterEach(() => vi.restoreAllMocks());

describe("GET /escuelas", () => {
  it("equipo_padi gets all escuelas", async () => {
    mockAuthAs("equipo_padi", "u-padi");
    vi.spyOn(EscuelasRepository, "findAll").mockResolvedValue([{ id: "e-1", nombre: "Escuela Norte" }] as any);
    const res = await request(app).get("/escuelas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("encargado_zona gets only their zone's escuelas", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ id: "enc-1", zona_id: "z-1", zona: { id: "z-1" } }),
    };
    vi.spyOn(EscuelasRepository, "findByZonaId").mockResolvedValue([{ id: "e-1" }] as any);
    const res = await request(app).get("/escuelas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });

  it("returns 403 when role has no access", async () => {
    mockAuthAs("docente");
    const res = await request(app).get("/escuelas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("POST /escuelas", () => {
  it("equipo_padi creates escuela with zona_id", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "create").mockResolvedValue({ id: "e-new" } as any);
    const res = await request(app)
      .post("/escuelas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Escuela Nueva", zona_id: "z-1" });
    expect(res.status).toBe(201);
  });

  it("returns 400 when nombre is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/escuelas")
      .set("Authorization", "Bearer fake-token")
      .send({ zona_id: "z-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when zona_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/escuelas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Test" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /escuelas/:id", () => {
  it("equipo_padi updates escuela", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "update").mockResolvedValue({ id: "e-1" } as any);
    const res = await request(app)
      .put("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Updated", zona_id: "z-1" });
    expect(res.status).toBe(200);
  });

  it("returns 400 when nombre is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .put("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token")
      .send({ zona_id: "z-1" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /escuelas/:id", () => {
  it("equipo_padi deletes escuela", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "delete").mockResolvedValue(undefined as any);
    const res = await request(app)
      .delete("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });

  it("returns 403 when not equipo_padi", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .delete("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("POST /escuelas/asignar-directivo", () => {
  it("equipo_padi assigns directivo", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "addDirectivoRelation").mockResolvedValue(undefined as any);
    const res = await request(app)
      .post("/escuelas/asignar-directivo")
      .set("Authorization", "Bearer fake-token")
      .send({ escuelaId: "e-1", usuarioId: "u-1" });
    expect(res.status).toBe(200);
  });
});

describe("POST /escuelas/desasignar-directivo", () => {
  it("equipo_padi removes directivo", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "removeDirectivoRelation").mockResolvedValue(undefined as any);
    const res = await request(app)
      .post("/escuelas/desasignar-directivo")
      .set("Authorization", "Bearer fake-token")
      .send({ usuarioId: "u-1" });
    expect(res.status).toBe(200);
  });
});
describe("escuelas - error branches and encargado_zona service path", () => {
  it("GET /escuelas service throws returns 500", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "findAll").mockRejectedValue(new Error("DB error"));
    const res = await request(app).get("/escuelas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(500);
  });

  it("POST /escuelas as encargado_zona creates escuela from own zone", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    // findEncargadoProfile in repo calls prisma.encargados.findUnique
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ id: "enc-1", zona_id: "z-1", zona: { id: "z-1" } }),
    };
    vi.spyOn(EscuelasRepository, "create").mockResolvedValue({ id: "e-new" } as any);
    const res = await request(app)
      .post("/escuelas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Nueva Escuela", zona_id: "z-1" });
    expect(res.status).toBe(201);
  });

  it("POST /escuelas as encargado_zona with no zone returns 400", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue(null), // no encargado profile
    };
    const res = await request(app)
      .post("/escuelas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Nueva Escuela", zona_id: "z-1" });
    expect(res.status).toBe(400);
  });

  it("PUT /escuelas/:id service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "update").mockRejectedValue(new Error("DB error"));
    const res = await request(app)
      .put("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Test", zona_id: "z-1" });
    expect(res.status).toBe(400);
  });

  it("POST /escuelas/asignar-directivo service throws returns 500", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "addDirectivoRelation").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/escuelas/asignar-directivo")
      .set("Authorization", "Bearer fake-token")
      .send({ escuelaId: "e-1", usuarioId: "u-1" });
    expect(res.status).toBe(500);
  });

  it("POST /escuelas/desasignar-directivo service throws returns 500", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "removeDirectivoRelation").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/escuelas/desasignar-directivo")
      .set("Authorization", "Bearer fake-token")
      .send({ usuarioId: "u-1" });
    expect(res.status).toBe(500);
  });

  it("DELETE /escuelas/:id service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "delete").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .delete("/escuelas/e-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});