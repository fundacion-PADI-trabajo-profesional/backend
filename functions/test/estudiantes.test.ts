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