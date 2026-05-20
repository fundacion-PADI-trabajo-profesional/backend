import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { ZonasRepository } from "../src/repositories/zona.repository";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();
afterEach(() => vi.restoreAllMocks());

describe("GET /zonas", () => {
  it("equipo_padi lists all zonas", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listAll").mockResolvedValue([{ id: "z-1", nombre: "Norte" }] as any);
    const res = await request(app).get("/zonas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe("z-1");
  });

  it("non-padi gets 403", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app).get("/zonas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("POST /zonas", () => {
  it("equipo_padi creates zona", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "create").mockResolvedValue({ id: "z-new", nombre: "Sur" } as any);
    const res = await request(app)
      .post("/zonas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Sur" });
    expect(res.status).toBe(201);
  });

  it("non-padi gets 403", async () => {
    mockAuthAs("director");
    const res = await request(app)
      .post("/zonas")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Sur" });
    expect(res.status).toBe(403);
  });
});

describe("GET /zonas/:id", () => {
  it("equipo_padi gets zone details", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "findById").mockResolvedValue({ id: "z-1", nombre: "Norte", escuelas: [], encargados: [] } as any);
    const res = await request(app).get("/zonas/z-1").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });
});

describe("POST /zonas/:id/asignar-escuela", () => {
  it("assigns escuela to zona", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "assignEscuela").mockResolvedValue({ id: "e-1" } as any);
    const res = await request(app)
      .post("/zonas/z-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuelaId: "e-1" });
    expect(res.status).toBe(200);
  });
});

describe("GET /escuelas-sin-zona", () => {
  it("lists available escuelas", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEscuelasSinZona").mockResolvedValue([{ id: "e-free" }] as any);
    const res = await request(app).get("/escuelas-sin-zona").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });
});

describe("POST /escuelas/:escuelaId/quitar-escuela", () => {
  it("removes escuela from zona", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "unassignEscuela").mockResolvedValue({ id: "e-1" } as any);
    const res = await request(app)
      .post("/escuelas/e-1/quitar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(200);
  });
});

describe("PUT /zonas/:id", () => {
  it("equipo_padi updates zona name", async () => {
    mockAuthAs("equipo_padi");
    // findByName is called first to check for duplicates — mock it returning null (no conflict)
    vi.spyOn(ZonasRepository, "findByName").mockResolvedValue(null);
    vi.spyOn(ZonasRepository, "update").mockResolvedValue({ id: "z-1", nombre: "Norte 2" } as any);
    const res = await request(app)
      .put("/zonas/z-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Norte 2" });
    expect(res.status).toBe(200);
  });
});

describe("GET /encargados-sin-zona", () => {
  it("lists encargados without zone", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEncargadosDisponibles").mockResolvedValue([] as any);
    const res = await request(app).get("/encargados-sin-zona").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });
});

describe("GET /zonas/encargados", () => {
  it("lists all encargados", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEncargados").mockResolvedValue([{ id: "enc-1" }] as any);
    const res = await request(app).get("/zonas/encargados").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });
});

describe("POST /zonas/:id/asignar-encargado", () => {
  it("assigns encargado to zona", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "assignEncargado").mockResolvedValue({ id: "enc-1" } as any);
    const res = await request(app)
      .post("/zonas/z-1/asignar-encargado")
      .set("Authorization", "Bearer fake-token")
      .send({ encargadoId: "enc-1" });
    expect(res.status).toBe(200);
  });
});

describe("POST /encargados/:encargadoId/quitar-zona", () => {
  it("removes encargado from zona", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "unassignEncargado").mockResolvedValue({ id: "enc-1" } as any);
    const res = await request(app)
      .post("/encargados/enc-1/quitar-zona")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(200);
  });
});

describe("zonas - catch block error paths", () => {
  it("POST /zonas service throws returns 403", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "create").mockRejectedValue(new Error("DB fail"));
    const res = await request(app).post("/zonas").set("Authorization", "Bearer fake-token").send({ nombre: "X" });
    expect(res.status).toBe(403);
  });

  it("GET /zonas service throws returns 403", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listAll").mockRejectedValue(new Error("DB fail"));
    const res = await request(app).get("/zonas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("GET /zonas/:id service throws returns 404", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "findById").mockRejectedValue(new Error("not found"));
    const res = await request(app).get("/zonas/z-99").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(404);
  });

  it("POST /zonas/:id/asignar-escuela service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "assignEscuela").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/zonas/z-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuelaId: "e-1" });
    expect(res.status).toBe(400);
  });

  it("GET /escuelas-sin-zona service throws returns 403", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEscuelasSinZona").mockRejectedValue(new Error("fail"));
    const res = await request(app).get("/escuelas-sin-zona").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("POST /escuelas/:escuelaId/quitar-escuela service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "unassignEscuela").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/escuelas/e-1/quitar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("PUT /zonas/:id service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "findByName").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .put("/zonas/z-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "X" });
    expect(res.status).toBe(400);
  });

  it("GET /encargados-sin-zona service throws returns 403", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEncargadosDisponibles").mockRejectedValue(new Error("fail"));
    const res = await request(app).get("/encargados-sin-zona").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("GET /zonas/encargados service throws returns 403", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "listEncargados").mockRejectedValue(new Error("fail"));
    const res = await request(app).get("/zonas/encargados").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("POST /zonas/:id/asignar-encargado service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "assignEncargado").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/zonas/z-1/asignar-encargado")
      .set("Authorization", "Bearer fake-token")
      .send({ encargadoId: "enc-1" });
    expect(res.status).toBe(400);
  });

  it("POST /encargados/:encargadoId/quitar-zona service throws returns 400", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ZonasRepository, "unassignEncargado").mockRejectedValue(new Error("fail"));
    const res = await request(app)
      .post("/encargados/enc-1/quitar-zona")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });
});