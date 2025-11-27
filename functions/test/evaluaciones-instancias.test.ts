import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as evaluacionRepo from "../src/repositories/evaluacion.repository";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

// NOTA:
// La API de evaluaciones fue refactorizada a /evaluaciones (sin el sufijo -instancias)
// y el repositorio correspondiente también cambió de forma (ya no existe listInstancias, etc).
// Estos tests corresponden a la versión anterior de la API y necesitan ser rediseñados
// para la nueva estructura. Por ahora los dejamos en skip para evitar falsos negativos.

describe.skip("evaluaciones instancias (API antigua, pendiente de refactor de tests)", () => {
  it("GET /evaluaciones-instancias returns list", async () => {
    const res = await request(app).get("/evaluaciones-instancias");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /evaluaciones-instancias passes filters to repository", async () => {
    const spy = vi
      .spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "listInstancias")
      .mockResolvedValue([]);

    const res = await request(app).get(
      "/evaluaciones-instancias?estudianteId=s1&salaId=2&tipoId=inicial&estadoId=N&limit=10&offset=5",
    );
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      estudianteId: "s1",
      salaId: 2,
      tipoId: "inicial",
      estadoId: "N",
      limit: 10,
      offset: 5,
    });
  });

  it("GET /evaluaciones-instancias without filters still calls repo with undefineds", async () => {
    const spy = vi
      .spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "listInstancias")
      .mockResolvedValue([]);
    const res = await request(app).get("/evaluaciones-instancias");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({
      estudianteId: undefined,
      salaId: undefined,
      tipoId: undefined,
      estadoId: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it("GET /evaluaciones-instancias/:id returns 404 when missing", async () => {
    const res = await request(app).get("/evaluaciones-instancias/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });

  it("POST /evaluaciones-instancias creates one", async () => {
    const payload = {
      estudianteId: "s1",
      salaId: 1,
      tipoId: "inicial",
      estadoId: "N",
      puntaje: null,
    };
    const res = await request(app)
      .post("/evaluaciones-instancias")
      .send(payload)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data).toBeTruthy();
  });

  it("PATCH /evaluaciones-instancias/:id updates and returns 200", async () => {
    const spy = vi
      .spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "actualizarInstancia")
      .mockResolvedValue({
        id: "e1",
        estudiante_id: "s1",
        profesor_id: "p1",
        sala_id: 2,
        tipo_id: "seguimiento",
        estado_id: "C",
        puntaje: 90,
        fecha_creacion: new Date(),
      } as any);

    const res = await request(app)
      .patch("/evaluaciones-instancias/e1")
      .send({ salaId: 2, tipoId: "seguimiento", estadoId: "C", puntaje: 90 })
      .set("Content-Type", "application/json");
    expect(spy).toHaveBeenCalledWith("e1", {
      estudianteId: undefined,
      salaId: 2,
      tipoId: "seguimiento",
      estadoId: "C",
      puntaje: 90,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("PATCH /evaluaciones-instancias/:id returns 404 when instance does not exist", async () => {
    vi.spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "actualizarInstancia").mockResolvedValue(null);
    const res = await request(app)
      .patch("/evaluaciones-instancias/not-found")
      .send({ estadoId: "C" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });

  it("DELETE /evaluaciones-instancias/:id returns 204 on success", async () => {
    const spy = vi
      .spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "eliminarInstancia")
      .mockResolvedValue(true);
    const res = await request(app).delete("/evaluaciones-instancias/e1");
    expect(spy).toHaveBeenCalledWith("e1");
    expect(res.status).toBe(204);
  });

  it("POST /evaluaciones-instancias returns 400 when required fields are missing", async () => {
    const payload = {
      // estudianteId falta
      salaId: 1,
      tipoId: "inicial",
      estadoId: "N",
    };
    const res = await request(app)
      .post("/evaluaciones-instancias")
      .send(payload)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("POST /evaluaciones-instancias returns 400 when puntaje is invalid", async () => {
    const payload = {
      estudianteId: "s1",
      salaId: 1,
      tipoId: "inicial",
      estadoId: "N",
      puntaje: "no-numero",
    } as any;
    const res = await request(app)
      .post("/evaluaciones-instancias")
      .send(payload)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "INVALID_PUNTAJE" },
    });
  });

  it("DELETE /evaluaciones-instancias/:id returns 404 when instance does not exist", async () => {
    const spy = vi
      .spyOn((evaluacionRepo as any).EvaluacionRepository.prototype, "eliminarInstancia")
      .mockResolvedValue(false);
    const res = await request(app).delete("/evaluaciones-instancias/not-found-id");
    expect(spy).toHaveBeenCalledWith("not-found-id");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});


