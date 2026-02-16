import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EstudianteRepository } from "../src/repositories/estudiante.repository";

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
    const res = await request(app).get("/estudiantes");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("POST /estudiantes creates one (201)", async () => {
    const created = {
      id: "s1",
      persona_id: "p1",
      genero_id: "F",
      grado: 1,
      sala_id: 1,
      fecha_creacion: new Date().toISOString(),
      persona: {
        id: "p1",
        dni: payloadOk.dni,
        nombre: payloadOk.nombre,
        primer_apellido: payloadOk.apellido,
        segundo_apellido: null,
        fecha_nacimiento: payloadOk.fecha_nacimiento,
      },
    };
    const spy = vi.spyOn(EstudianteRepository, "create").mockResolvedValue(created as any);
    const res = await request(app)
      .post("/estudiantes")
      .send(payloadOk)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.id).toBe("s1");
    expect(spy).toHaveBeenCalledWith({
      dni: payloadOk.dni,
      nombre: payloadOk.nombre,
      apellido: payloadOk.apellido,
      fecha_nacimiento: payloadOk.fecha_nacimiento,
      genero_id: payloadOk.genero_id,
      sala_id: payloadOk.sala_id,
      escuela_id: payloadOk.escuela_id,
    });
  });

  it("POST /estudiantes returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/estudiantes")
      .send({
        // falta dni, nombre, etc.
        sala_id: 1,
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("POST /estudiantes returns 400 when DNI is duplicated", async () => {
    vi.spyOn(EstudianteRepository, "create").mockRejectedValue(
      new Error("Ya existe un estudiante con ese DNI."),
    );
    const res = await request(app)
      .post("/estudiantes")
      .send(payloadOk)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "DNI_DUPLICADO" },
    });
  });

  it("POST /estudiantes returns 400 when Sala does not exist", async () => {
    vi.spyOn(EstudianteRepository, "create").mockRejectedValue(
      new Error("La sala seleccionada no existe"),
    );
    const res = await request(app)
      .post("/estudiantes")
      .send(payloadOk)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(String(res.body.error?.description || "")).toContain("La sala seleccionada no existe");
  });
});


