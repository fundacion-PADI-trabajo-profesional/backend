import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { mockAuthAs } from "./helpers/auth-mock";

/**
 * PUT /evaluaciones/:id/datos-evaluador — "Preguntas para el evaluador" (ADR 0020).
 */
const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

const CIERRE = {
  id: "ev-1",
  profesor_id: "docente-1",
  estudiante_id: "s1",
  sala_id: 4,
  aula_id: "aula-1",
  tipo_id: "cierre",
  fecha_creacion: new Date("2026-11-10T00:00:00Z"),
  estudiantes: { escuela_id: "esc-a" },
};

const COMPLETO = { sesiones_completadas: "entre_5_y_9", en_tratamiento: true, tiene_cud: true, observaciones: " Trabajó mejor a solas. " };
const NORMALIZADO = { ...COMPLETO, observaciones: "Trabajó mejor a solas." };

function preparar(original: Record<string, unknown> | null = CIERRE) {
  const findById = vi.spyOn(EvaluacionRepository, "findById");
  if (original) {
    findById.mockResolvedValueOnce(original as any).mockResolvedValueOnce({ ...original, ...NORMALIZADO } as any);
  } else {
    findById.mockResolvedValue(null);
  }
  return vi.spyOn(EvaluacionRepository, "updateDatosEvaluador").mockResolvedValue(undefined);
}

const put = (body: unknown = COMPLETO) =>
  request(app).put("/evaluaciones/ev-1/datos-evaluador").set("Authorization", "Bearer fake-token").send(body as object);

describe("PUT /evaluaciones/:id/datos-evaluador", () => {
  it("sin token → 401", async () => {
    const res = await request(app).put("/evaluaciones/ev-1/datos-evaluador").send(COMPLETO);
    expect(res.status).toBe(401);
  });

  it("equipo_padi guarda un cierre completo: 200, normaliza y devuelve la evaluación actualizada", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar();

    const res = await put();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.en_tratamiento).toBe(true);
    expect(res.body.data.observaciones).toBe("Trabajó mejor a solas.");
    expect(updateSpy).toHaveBeenCalledWith("ev-1", NORMALIZADO);
  });

  it("en una evaluación inicial las sesiones se guardan en null", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar({ ...CIERRE, tipo_id: "inicial" });

    expect((await put()).status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith("ev-1", { ...NORMALIZADO, sesiones_completadas: null });
  });

  it("guardado parcial: lo que no viene queda en null", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar();

    expect((await put({ en_tratamiento: false })).status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith("ev-1", { sesiones_completadas: null, en_tratamiento: false, tiene_cud: null, observaciones: null });
  });

  it("valor fuera de lo permitido → 400 DATOS_EVALUADOR_INVALIDOS y no guarda", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar();

    const res = await put({ sesiones_completadas: "muchas" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DATOS_EVALUADOR_INVALIDOS");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("evaluación inexistente → 404", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar(null);

    const res = await put();

    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("docente sobre una evaluación propia → 200", async () => {
    mockAuthAs("docente", "docente-1");
    preparar();
    expect((await put()).status).toBe(200);
  });

  it("docente sobre una evaluación ajena de un aula que tiene asignada → 200", async () => {
    const { prismaMock } = mockAuthAs("docente", "docente-2");
    prismaMock.profesoresAulas.findFirst = vi.fn().mockResolvedValue({ profesor_id: "docente-2", aula_id: "aula-1" });
    const updateSpy = preparar();

    expect((await put()).status).toBe(200);
    expect(prismaMock.profesoresAulas.findFirst).toHaveBeenCalledWith({ where: { profesor_id: "docente-2", aula_id: "aula-1", fecha_fin: null } });
    expect(updateSpy).toHaveBeenCalled();
  });

  it("docente sobre una evaluación ajena de un aula que no es suya → 403 y no guarda", async () => {
    mockAuthAs("docente", "docente-2"); // profesoresAulas.findFirst devuelve null por defecto
    const updateSpy = preparar();

    const res = await put();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("docente sobre una evaluación ajena sin aula → 403", async () => {
    mockAuthAs("docente", "docente-2");
    const updateSpy = preparar({ ...CIERRE, aula_id: null });

    expect((await put()).status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("director de la misma escuela → 200; de otra escuela → 403", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: "esc-a" });
    preparar();
    expect((await put()).status).toBe(200);
    vi.restoreAllMocks();

    mockAuthAs("director", "dir-1", { escuela_id: "esc-b" });
    const updateSpy = preparar();
    expect((await put()).status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("alumno dado de baja → 403 y no guarda (solo lectura también en el backend)", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const updateSpy = preparar({ ...CIERRE, estudiantes: { escuela_id: "esc-a", fecha_baja: new Date("2026-09-01T00:00:00Z") } });

    const res = await put();

    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
