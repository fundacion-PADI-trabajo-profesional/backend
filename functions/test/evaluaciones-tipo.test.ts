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

describe("PATCH /evaluaciones/:id - cambiar tipo", () => {
  const ORIGINAL = {
    id: "ev-1",
    profesor_id: "docente-1",
    estudiante_id: "s1",
    sala_id: 4,
    tipo_id: "inicial",
    fecha_creacion: new Date("2026-10-20T00:00:00Z"),
    estudiantes: { escuela_id: "esc-a" },
  };
  const ACTUALIZADA = { ...ORIGINAL, tipo_id: "cierre" };

  function prepararPatch(opts: { original?: typeof ORIGINAL | null; duplicado?: { id: string; tipo_id: string; fecha_creacion: Date } | null } = {}) {
    const original = opts.original === undefined ? ORIGINAL : opts.original;
    const findById = vi.spyOn(EvaluacionRepository, "findById");
    if (original) {
      findById.mockResolvedValueOnce(original as any).mockResolvedValueOnce({ ...original, tipo_id: "cierre" } as any);
    } else {
      findById.mockResolvedValue(null);
    }
    const dupSpy = vi.spyOn(EvaluacionRepository, "findDuplicadoTipo").mockResolvedValue(opts.duplicado ?? null);
    const updateSpy = vi.spyOn(EvaluacionRepository, "updateTipo").mockResolvedValue(undefined);
    return { dupSpy, updateSpy };
  }

  const patch = (tipo_id?: unknown) =>
    request(app).patch("/evaluaciones/ev-1").set("Authorization", "Bearer fake-token").send(tipo_id === undefined ? {} : { tipo_id });

  it("equipo_padi cambia inicial → cierre: 200, actualiza y excluye la propia evaluación del chequeo", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const { dupSpy, updateSpy } = prepararPatch();

    const res = await patch("cierre");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tipo_id).toBe(ACTUALIZADA.tipo_id);
    expect(updateSpy).toHaveBeenCalledWith("ev-1", "cierre");
    expect(dupSpy).toHaveBeenCalledWith(expect.objectContaining({ excluirId: "ev-1", tipoId: "cierre", anio: 2026, salaId: 4, estudianteId: "s1" }));
  });

  it("docente sobre una evaluación propia → 200", async () => {
    mockAuthAs("docente", "docente-1");
    prepararPatch();
    expect((await patch("cierre")).status).toBe(200);
  });

  it("docente sobre una evaluación ajena → 403 y no actualiza", async () => {
    mockAuthAs("docente", "docente-1");
    const { updateSpy } = prepararPatch({ original: { ...ORIGINAL, profesor_id: "otro" } });
    const res = await patch("cierre");
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("director de la misma escuela → 200; de otra escuela → 403; sin escuela asignada → 200", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: "esc-a" });
    prepararPatch();
    expect((await patch("cierre")).status).toBe(200);
    vi.restoreAllMocks();

    mockAuthAs("director", "dir-1", { escuela_id: "esc-b" });
    const { updateSpy } = prepararPatch();
    expect((await patch("cierre")).status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    mockAuthAs("director", "dir-1", { escuela_id: null });
    prepararPatch();
    expect((await patch("cierre")).status).toBe(200);
  });

  it("encargado: escuela fuera de su zona → 403; dentro → 200", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = { findUnique: vi.fn().mockResolvedValue({ zona: { escuelas: [{ id: "esc-z" }] } }) };
    prepararPatch();
    expect((await patch("cierre")).status).toBe(403);
    vi.restoreAllMocks();

    const { prismaMock: pm2 } = mockAuthAs("encargado_zona", "enc-1");
    pm2.encargados = { findUnique: vi.fn().mockResolvedValue({ zona: { escuelas: [{ id: "esc-a" }, { id: "esc-z" }] } }) };
    prepararPatch();
    expect((await patch("cierre")).status).toBe(200);
  });

  it("tipo_id inválido o ausente → 400 TIPO_INVALIDO", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const { updateSpy } = prepararPatch();
    const res1 = await patch("final");
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("TIPO_INVALIDO");
    const res2 = await patch();
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("TIPO_INVALIDO");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ya existe un cierre del alumno en esa sala y año → 400 TIPO_DUPLICADO sin actualizar", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const { updateSpy } = prepararPatch({ duplicado: { id: "ev-c", tipo_id: "cierre", fecha_creacion: new Date("2026-11-01T00:00:00Z") } });
    const res = await patch("cierre");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TIPO_DUPLICADO");
    expect(res.body.error.details.evaluacion_existente.id).toBe("ev-c");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("mismo tipo que ya tiene → 200 sin consultar duplicados ni actualizar", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    const { dupSpy, updateSpy } = prepararPatch();
    const res = await patch("inicial");
    expect(res.status).toBe(200);
    expect(res.body.data.tipo_id).toBe("inicial");
    expect(dupSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("evaluación inexistente → 404", async () => {
    mockAuthAs("equipo_padi", "padi-1");
    prepararPatch({ original: null });
    expect((await patch("cierre")).status).toBe(404);
  });

  it("sin token → 401", async () => {
    const res = await request(app).patch("/evaluaciones/ev-1").send({ tipo_id: "cierre" });
    expect(res.status).toBe(401);
  });
});
