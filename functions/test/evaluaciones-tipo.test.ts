import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { EvaluacionService } from "../src/services/evaluaciones.service";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

const EXISTENTE = { id: "ev-prev", tipo_id: "inicial", fecha_creacion: new Date("2026-03-12T00:00:00Z") };

function prepararAlta(duplicado: typeof EXISTENTE | null) {
  vi.spyOn(EvaluacionService.prototype as any, "ensureProfesorRecord").mockResolvedValue(undefined);
  vi.spyOn(EvaluacionRepository, "findEstudianteByDni").mockResolvedValue({ id: "s1", sala_id: 4 } as any);
  const dupSpy = vi.spyOn(EvaluacionRepository, "findDuplicadoTipo").mockResolvedValue(duplicado);
  const createSpy = vi.spyOn(EvaluacionRepository, "create").mockResolvedValue({ id: "e-new", tipo_id: "inicial" } as any);
  return { dupSpy, createSpy };
}

function body(tipo_id: string) {
  return { dni: "1", profesor_id: "docente-1", sala_id: 4, tipo_id, fecha_creacion: "2026-11-02" };
}

describe("POST /evaluaciones - freno de duplicados por tipo", () => {
  it("rechaza una segunda inicial del mismo alumno, sala y año con 400 TIPO_DUPLICADO", async () => {
    mockAuthAs("docente", "docente-1");
    const { createSpy } = prepararAlta(EXISTENTE);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body("inicial"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TIPO_DUPLICADO");
    expect(res.body.message).toContain("inicial de sala 4 cargada el 12/03/2026");
    expect(res.body.error.details.evaluacion_existente.id).toBe("ev-prev");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("el duplicado de cierre usa el mensaje de cierre", async () => {
    mockAuthAs("docente", "docente-1");
    prepararAlta({ ...EXISTENTE, id: "ev-c", tipo_id: "cierre" });

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body("cierre"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TIPO_DUPLICADO");
    expect(res.body.message).toContain("de cierre de sala 4");
  });

  it("sin duplicado crea (201) y consultó por alumno, sala, tipo y año de fecha_creacion", async () => {
    mockAuthAs("docente", "docente-1");
    const { dupSpy, createSpy } = prepararAlta(null);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body("inicial"));

    expect(res.status).toBe(201);
    expect(dupSpy).toHaveBeenCalledWith({ estudianteId: "s1", salaId: 4, tipoId: "inicial", anio: 2026 });
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("tipo_id fuera de inicial/cierre → 400 TIPO_INVALIDO sin consultar ni crear", async () => {
    mockAuthAs("docente", "docente-1");
    const { dupSpy, createSpy } = prepararAlta(null);

    const res = await request(app).post("/evaluaciones").set("Authorization", "Bearer fake-token").send(body("final"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TIPO_INVALIDO");
    expect(dupSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
