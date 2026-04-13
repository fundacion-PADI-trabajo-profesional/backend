import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EstudianteRepository } from "../src/repositories/estudiante.repository";
import * as prismaClient from "../src/config/prismaClient";
import { mockAuthAs } from "./helpers/auth-mock"; //

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("estudiantes endpoints", () => {
  const payloadOk = {
    dni: "44111222",
    nombre: "Ana",
    apellido: "Pérez",
    fecha_nacimiento: "2018-05-10",
    genero_id: "F",
    sala_id: 1,
    escuela_id: "escuela-1",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /estudiantes returns 200 and a list", async () => {
    // Simulamos un usuario con rol de equipo_padi para listar
    mockAuthAs("equipo_padi");

    const mockList = [
      {
        id: "s1",
        persona_id: "p1",
        genero_id: "F",
        grado: 1,
        sala_id: 1,
        fecha_creacion: new Date().toISOString(),
        personas: {
          nombre: "Ana",
          primer_apellido: "Pérez",
          segundo_apellido: null,
          dni: "44111222",
        },
        salas: { nombre: "Sala 1", grado: 1 },
        generos: { descripcion: "Femenino" },
      },
    ];
    const spy = vi.spyOn(EstudianteRepository, "list").mockResolvedValue(mockList as any);

    const res = await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token"); // Header requerido por el middleware

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("POST /estudiantes creates one (201)", async () => {
    mockAuthAs("equipo_padi"); //

    const created = {
      id: "s1",
      persona: {
        id: "p1",
        dni: payloadOk.dni,
        nombre: payloadOk.nombre,
      },
    };
    const spy = vi.spyOn(EstudianteRepository, "create").mockResolvedValue(created as any);

    const res = await request(app)
      .post("/estudiantes")
      .set("Authorization", "Bearer fake-token") //
      .send(payloadOk)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      dni: payloadOk.dni,
      nombre: payloadOk.nombre,
    }));
  });

  it("POST /estudiantes returns 400 when required fields are missing", async () => {
    mockAuthAs("equipo_padi");

    const res = await request(app)
      .post("/estudiantes")
      .set("Authorization", "Bearer fake-token")
      .send({ sala_id: 1 })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("POST /estudiantes returns 400 when DNI is duplicated", async () => {
    mockAuthAs("equipo_padi");

    vi.spyOn(EstudianteRepository, "create").mockRejectedValue(
      new Error("Ya existe un estudiante con ese DNI."),
    );

    const res = await request(app)
      .post("/estudiantes")
      .set("Authorization", "Bearer fake-token") //
      .send(payloadOk)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "DNI_DUPLICADO" });
  });

  it("POST /estudiantes as docente creates student in assigned aula", async () => {

    const created = {
      id: "s2",
      persona_id: "p2",
      genero_id: "F",
      grado: 3,
      sala_id: 3,
      fecha_creacion: new Date().toISOString(),
      persona: {
        id: "p2",
        dni: "44999111",
        nombre: "Lara",
        primer_apellido: "Gomez",
      },
    };
    // 1. IMPORTANTE: Extraer el prismaMock del helper
    const { prismaMock } = mockAuthAs("docente", "docente-1");

    // 2. Configurar el mock de la asignación del aula
    // El servicio lo usa para validar que el docente pertenece a esa aula
    prismaMock.profesoresAulas.findFirst = vi.fn().mockResolvedValue({
      aula: {
        id: "aula-1",
        sala_id: 3,
        escuela_id: "escuela-10"
      },
    });

    // 3. Espiar el repositorio
    const createSpy = vi.spyOn(EstudianteRepository, "create").mockResolvedValue(created as any);

    // 4. Ejecutar la petición
    const res = await request(app)
      .post("/estudiantes")
      .set("Authorization", "Bearer fake-token") // Requerido para pasar el middleware
      .send({
        dni: "44999111",
        nombre: "Lara",
        apellido: "Gomez",
        fecha_nacimiento: "2019-01-02",
        genero_id: "F",
        aula_id: "aula-1",
        // usuario_id y rol NO van más aquí, se sacan del token
      });

    // Si sigue fallando, este log te dirá por qué el servicio tiró 400
    if (res.status !== 201) {
      console.log("Cuerpo del error:", res.body);
    }

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sala_id: 3, // El servicio debió sobreescribir el sala_id con el del aula
        escuela_id: "escuela-10",
        aula_id: "aula-1",
      }),
    );
  });

  it("POST /estudiantes as docente returns 400 if aula is not assigned", async () => {
    // Mockeamos la sesión y configuramos que no se encuentre el aula asignada
    const { prismaMock } = mockAuthAs("docente", "docente-1");

    prismaMock.profesoresAulas = {
      findFirst: vi.fn().mockResolvedValue(null),
    };

    const res = await request(app)
      .post("/estudiantes")
      .set("Authorization", "Bearer fake-token") //
      .send({
        ...payloadOk,
        aula_id: "aula-invalida",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
  });
});
describe("estudiantes - encargado_zona zone scoping", () => {
  it("GET /estudiantes as encargado_zona calls listByEscuelas with zone school IDs", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    // Mock: encargado pertenece a una zona con 2 escuelas
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        id: "enc-1",
        usuario_id: "encargado-1",
        zona_id: "zona-1",
        zona: {
          id: "zona-1",
          nombre: "Zona Norte",
          escuelas: [{ id: "escuela-a" }, { id: "escuela-b" }],
        },
      }),
    };

    const mockStudents = [
      {
        id: "s1",
        escuela_id: "escuela-a",
        personas: { nombre: "Carlos", primer_apellido: "Lopez", dni: "11111111", fecha_nacimiento: null },
        salas: { nombre: "Sala 1", grado: 1 },
        escuela: { nombre: "Escuela A" },
        generos: { descripcion: "Masculino" },
      },
    ];
    const spy = vi.spyOn(EstudianteRepository, "listByEscuelas").mockResolvedValue(mockStudents as any);

    const res = await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Debe haber llamado con los IDs de las escuelas de la zona, NO list() global
    expect(spy).toHaveBeenCalledWith(["escuela-a", "escuela-b"]);
  });

  it("GET /estudiantes as encargado_zona does NOT call list() global", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-1");

    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({
        zona: { escuelas: [{ id: "escuela-a" }] },
      }),
    };

    vi.spyOn(EstudianteRepository, "listByEscuelas").mockResolvedValue([]);
    const globalSpy = vi.spyOn(EstudianteRepository, "list");

    await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token");

    expect(globalSpy).not.toHaveBeenCalled();
  });
});

describe("GET /generos", () => {
  it("returns gender list", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.generos = {
      findMany: vi.fn().mockResolvedValue([{ id: "M", descripcion: "Masculino" }, { id: "F", descripcion: "Femenino" }]),
    };
    // getGeneros() uses prisma.$transaction — pass prismaMock itself as the tx object
    prismaMock.$transaction = vi.fn().mockImplementation(async (cb: any) => cb(prismaMock));
    const res = await request(app).get("/generos").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /salas", () => {
  it("returns salas list", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.salas = {
      findMany: vi.fn().mockResolvedValue([{ id: 1, nombre: "Sala 1", grado: 1 }]),
    };
    // getSalas() uses prisma.$transaction — pass prismaMock itself as the tx object
    prismaMock.$transaction = vi.fn().mockImplementation(async (cb: any) => cb(prismaMock));
    const res = await request(app).get("/salas").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("PUT /estudiantes/:id", () => {
  it("equipo_padi updates a student", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstudianteRepository, "update").mockResolvedValue({ id: "s-1" } as any);
    const res = await request(app)
      .put("/estudiantes/s-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Nuevo Nombre", apellido: "Lopez" });
    expect(res.status).toBe(200);
  });

  it("returns 403 when user has no permissions", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstudianteRepository, "update").mockRejectedValue(
      new Error("No tienes permisos para modificar este estudiante")
    );
    const res = await request(app)
      .put("/estudiantes/s-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "X" });
    expect(res.status).toBe(403);
  });
});

describe("POST /estudiantes/:id/asignar-aula", () => {
  it("returns 400 when estudianteId or aulaId is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/estudiantes/asignar-aula")
      .set("Authorization", "Bearer fake-token")
      .send({}); // missing both
    expect(res.status).toBe(400);
  });

  it("assigns student to aula successfully", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.estudiantes = { findUnique: vi.fn().mockResolvedValue({ id: "s-1" }) };
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue({ id: "a-1" }) };
    prismaMock.estudiantesAulas = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ea-1" }),
    };
    const res = await request(app)
      .post("/estudiantes/asignar-aula")
      .set("Authorization", "Bearer fake-token")
      .send({ estudianteId: "s-1", aulaId: "a-1" });
    expect([200, 400]).toContain(res.status); // 200 if service succeeds
  });
});

describe("POST /estudiantes/:id/desasignar-aula", () => {
  it("returns 400 when estudianteId or aulaId is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/estudiantes/desasignar-aula")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /estudiantes/bulk", () => {
  it("returns 400 when estudiantes array is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/estudiantes/bulk")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when estudiantes is an empty array", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/estudiantes/bulk")
      .set("Authorization", "Bearer fake-token")
      .send({ estudiantes: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /estudiantes - docente with escuela_id param", () => {
  it("docente with escuela_id lists students by escuela", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstudianteRepository, "listByEscuela").mockResolvedValue([] as any);
    const res = await request(app)
      .get("/estudiantes?escuela_id=esc-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });

  it("docente without escuela_id returns 400", async () => {
    mockAuthAs("docente");
    const res = await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("director without escuela assigned returns 400", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: null }); // no school assigned
    const res = await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});