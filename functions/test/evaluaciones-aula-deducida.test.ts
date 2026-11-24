import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { EvaluacionService } from "../src/services/evaluaciones.service";
import { elegirAulaDeEvaluacion } from "../src/utils/evaluaciones-aula";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("elegirAulaDeEvaluacion", () => {
  it("sin aulas activas no deduce nada", () => {
    expect(elegirAulaDeEvaluacion([], 4)).toBeUndefined();
  });

  it("con una sola aula activa usa esa, aunque sea de otra sala", () => {
    expect(elegirAulaDeEvaluacion([{ id: "a1", sala_id: 5 }], 4)).toBe("a1");
  });

  it("con varias aulas usa la única que coincide con la sala de la evaluación", () => {
    const aulas = [{ id: "a3", sala_id: 3 }, { id: "a5", sala_id: 5 }];
    expect(elegirAulaDeEvaluacion(aulas, 3)).toBe("a3");
  });

  it("con varias aulas de la misma sala no elige ninguna", () => {
    const aulas = [{ id: "a1", sala_id: 5 }, { id: "a2", sala_id: 5 }];
    expect(elegirAulaDeEvaluacion(aulas, 5)).toBeUndefined();
  });

  it("con varias aulas y ninguna de la sala no elige ninguna", () => {
    const aulas = [{ id: "a1", sala_id: 3 }, { id: "a2", sala_id: 5 }];
    expect(elegirAulaDeEvaluacion(aulas, 4)).toBeUndefined();
  });

  it("la misma aula repetida cuenta como una sola", () => {
    const aulas = [{ id: "a1", sala_id: 5 }, { id: "a1", sala_id: 5 }];
    expect(elegirAulaDeEvaluacion(aulas, 4)).toBe("a1");
  });
});

describe("POST /evaluaciones - aula deducida cuando el formulario no la manda", () => {
  function prepararAlta(aulasActivas: { id: string; sala_id: number }[]) {
    vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
    vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({ id: "s1", sala_id: 4 } as any);
    vi.spyOn(EvaluacionRepository, "findDuplicadoTipo").mockResolvedValue(null);
    const aulasSpy = vi.spyOn(EvaluacionRepository, "findAulasActivasDeEstudiante").mockResolvedValue(aulasActivas);
    const createSpy = vi.spyOn(EvaluacionRepository, "create").mockResolvedValue({ id: "e-new" } as any);
    return { aulasSpy, createSpy };
  }
  const body = { dni: "1", profesor_id: "docente-1", sala_id: 4, tipo_id: "cierre", fecha_creacion: "2026-11-02" };

  it("sin aula_id en el pedido guarda la única aula activa del alumno", async () => {
    mockAuthAs("docente", "docente-1");
    const { aulasSpy, createSpy } = prepararAlta([{ id: "a1", sala_id: 4 }]);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body);

    expect(res.status).toBe(201);
    expect(aulasSpy).toHaveBeenCalledWith("s1");
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ aula_id: "a1" }));
  });

  it("sin aula_id y con aulas ambiguas crea igual, sin aula", async () => {
    mockAuthAs("docente", "docente-1");
    const { createSpy } = prepararAlta([{ id: "a1", sala_id: 4 }, { id: "a2", sala_id: 4 }]);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body);

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ aula_id: undefined }));
  });

  it("con aula_id en el pedido no deduce: valida y usa la que vino", async () => {
    mockAuthAs("docente", "docente-1");
    const { aulasSpy, createSpy } = prepararAlta([{ id: "otra", sala_id: 4 }]);
    vi.spyOn(EvaluacionRepository, "findActiveEstudianteAula").mockResolvedValue({ aula: { id: "a9", sala_id: 4, escuela_id: "e" } } as any);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send({ ...body, aula_id: "a9" });

    expect(res.status).toBe(201);
    expect(aulasSpy).not.toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ aula_id: "a9" }));
  });
});
