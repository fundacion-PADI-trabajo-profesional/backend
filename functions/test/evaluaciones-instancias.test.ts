import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { EvaluacionService } from "../src/services/evaluaciones.service";
import { mockAuthAs } from "./helpers/auth-mock"; // Importar el helper

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("evaluaciones instancias (API /evaluaciones)", () => {
  const baseMock = [
    {
      id: "e1",
      estudiante_id: "s1",
      profesor_id: "p1",
      sala_id: 1,
      tipo_id: "inicial",
      estado_id: "N",
      puntaje: null,
      fecha_creacion: new Date(),
    },
    {
      id: "e2",
      estudiante_id: "s2",
      profesor_id: "p2",
      sala_id: 2,
      tipo_id: "cierre",
      estado_id: "C",
      puntaje: 10,
      fecha_creacion: new Date(),
    },
  ];

  it("GET /evaluaciones returns full list of evaluaciones", async () => {
    // 1. Mockeamos como equipo_padi para ver todo
    mockAuthAs("equipo_padi");

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue(baseMock as any);

    const res = await request(app)
      .get("/evaluaciones")
      .set("Authorization", "Bearer fake-token"); // Obligatorio

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(2);
  });

  it("GET /evaluaciones filters by estudianteId", async () => {
    mockAuthAs("equipo_padi");

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([baseMock[0]] as any);

    const res = await request(app)
      .get("/evaluaciones?estudianteId=s1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data[0].estudiante_id).toBe("s1");
  });

  it("GET /evaluaciones filters by profesorId", async () => {
    mockAuthAs("equipo_padi");

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([baseMock[1]] as any);

    const res = await request(app)
      .get("/evaluaciones?profesorId=p2")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data[0].profesor_id).toBe("p2");
  });

  it("GET /evaluaciones can combine multiple filters", async () => {
    // 1. Mockeamos la sesión
    mockAuthAs("equipo_padi");

    const extendedMock = [
      ...baseMock,
      {
        id: "e3",
        estudiante_id: "s1",
        profesor_id: "p2",
        sala_id: 1,
        tipo_id: "inicial",
        estado_id: "N",
        puntaje: null,
        fecha_creacion: new Date(),
      },
    ];

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([
      extendedMock[2],
    ] as any);

    // 2. Agregamos el header y quitamos IDs manuales de la URL
    const res = await request(app)
      .get("/evaluaciones?estudianteId=s1&profesorId=p2")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: "e3",
      estudiante_id: "s1",
      profesor_id: "p2",
    });
  });

  it("POST /evaluaciones guarda aula_id cuando viene en payload", async () => {
    // 1. Mockeamos la sesión (como docente que crea la evaluación)
    mockAuthAs("docente", "docente-1");

    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({ id: "s1", sala_id: 1 } as any);
    vi.spyOn(EvaluacionRepository, "findActiveEstudianteAula").mockResolvedValue({
      aula: { id: "a1", sala_id: 3, escuela_id: "esc1" },
    } as any);

    const createSpy = vi.spyOn(EvaluacionRepository, "create").mockResolvedValue({ id: "e100" } as any);

    const res = await request(app)
      .post("/evaluaciones")
      .set("Authorization", "Bearer fake-token")
      .send({
        dni: "44111222",
        profesor_id: "docente-1",
        tipo_id: "inicial",
        fecha_creacion: "2026-02",
        aula_id: "a1",
      });

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        estudiante_id: "s1",
        aula_id: "a1",
        sala_id: 1,
      }),
    );
  });

  it("POST /evaluaciones devuelve 400 si estudiante no está activo en el aula", async () => {
    mockAuthAs("docente", "docente-1");

    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({ id: "s1", sala_id: 1 } as any);
    vi.spyOn(EvaluacionRepository, "findActiveEstudianteAula").mockResolvedValue(null as any);

    const res = await request(app)
      .post("/evaluaciones")
      .set("Authorization", "Bearer fake-token")
      .send({
        dni: "44111222",
        profesor_id: "docente-1",
        tipo_id: "inicial",
        fecha_creacion: "2026-02",
        aula_id: "aula-invalida",
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toContain("no está asignado activamente al aula");
  });

  it("POST /evaluaciones permite crear evaluación para equipo_padi", async () => {
    // 1. Mockeamos la sesión de PADI
    mockAuthAs("equipo_padi", "padi-1");

    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({
      id: "s1",
      sala_id: 1,
    } as any);

    const createSpy = vi.spyOn(EvaluacionRepository, "create").mockResolvedValue({
      id: "e200",
      estudiante_id: "s1",
      profesor_id: "00000000-0000-0000-0000-000000000001",
      sala_id: 1,
      tipo_id: "inicial",
      estado_id: "N",
      fecha_creacion: new Date(),
    } as any);

    // 2. Request limpio: sin query params de usuario, con Authorization Header
    const res = await request(app)
      .post("/evaluaciones") // URL limpia
      .set("Authorization", "Bearer fake-token")
      .send({
        dni: "44111222",
        profesor_id: "00000000-0000-0000-0000-000000000001",
        tipo_id: "inicial",
        fecha_creacion: "2026-02",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(createSpy).toHaveBeenCalled();
  });

  it("DELETE /evaluaciones/:id permite eliminar para equipo_padi", async () => {
    // 1. Sesión de PADI
    mockAuthAs("equipo_padi", "padi-1");

    vi.spyOn(EvaluacionRepository, "findById").mockResolvedValue({ id: "e1", profesor_id: "p1" } as any);
    const deleteSpy = vi.spyOn(EvaluacionRepository, "delete").mockResolvedValue({ id: "e1" } as any);

    // 2. Ya no enviamos ?usuario_id=...&rol=...
    const res = await request(app)
      .delete("/evaluaciones/e1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(deleteSpy).toHaveBeenCalledWith("e1");
  });

  it("DELETE /evaluaciones/:id devuelve 401 si no hay token", async () => {
    // Probamos la seguridad real del middleware
    const res = await request(app).delete("/evaluaciones/e1");

    expect(res.status).toBe(401); // El middleware ahora exige el token
    expect(res.body).toMatchObject({ message: "Token de autenticación requerido." });
  });
});