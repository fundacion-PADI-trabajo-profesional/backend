import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { ReporteEscuelaRepository } from "../src/repositories/reporte-escuela.repository";
import { mockAuthAs } from "./helpers/auth-mock";
import { mkEval, mkResp, CATALOGOS, ESCUELA } from "./fixtures/reporte-escuela";

const app = createApp();
afterEach(() => vi.restoreAllMocks());

const ESC = "9a1de644-815e-46d1-bb8f-aa1837f8a88b";
const URL = `/reportes/escuela?escuela_id=${ESC}&periodo=2025`;

function mockRepoOk() {
  vi.spyOn(ReporteEscuelaRepository, "findEscuela").mockResolvedValue(ESCUELA);
  vi.spyOn(ReporteEscuelaRepository, "findCatalogos").mockResolvedValue(CATALOGOS);
  vi.spyOn(ReporteEscuelaRepository, "findEvaluacionesTerminadas").mockResolvedValue([
    mkEval({ id: "e1", est: "a", tipo: "inicial" }),
    mkEval({ id: "e2", est: "b", tipo: "inicial", desaprueba: ["sm"] }),
  ]);
  vi.spyOn(ReporteEscuelaRepository, "findRespuestas").mockResolvedValue([
    mkResp({ eval: "e1", area: "sm", pregunta: "p1", numero: 1, respuesta: 1 }),
    mkResp({ eval: "e2", area: "sm", pregunta: "p1", numero: 1, respuesta: 0 }),
  ]);
}

describe("GET /reportes/escuela", () => {
  it("equipo_padi → 200 con el reporte calculado", async () => {
    mockAuthAs("equipo_padi");
    mockRepoOk();
    const res = await request(app).get(URL).set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.escuela).toEqual(ESCUELA);
    expect(res.body.data.periodo).toBe(2025);
    expect(res.body.data.salas).toHaveLength(1);
    expect(res.body.data.salas[0].inicial.evaluados).toBe(2);
    expect(res.body.data.salas[0].inicial.pautas[0].items[0]).toEqual({ numero: 1, texto: "Consigna 1", desaprobaron: 1, evaluados: 2 });
    expect(ReporteEscuelaRepository.findEvaluacionesTerminadas).toHaveBeenCalledWith({
      escuelaId: ESC,
      periodoStart: new Date("2025-01-01T00:00:00.000Z"),
      periodoEnd: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(ReporteEscuelaRepository.findRespuestas).toHaveBeenCalledWith({ evaluacionIds: ["e1", "e2"] });
  });

  it("sin evaluaciones → 200 con salas vacías y no consulta respuestas", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ReporteEscuelaRepository, "findEscuela").mockResolvedValue(ESCUELA);
    vi.spyOn(ReporteEscuelaRepository, "findCatalogos").mockResolvedValue(CATALOGOS);
    vi.spyOn(ReporteEscuelaRepository, "findEvaluacionesTerminadas").mockResolvedValue([]);
    const spyResp = vi.spyOn(ReporteEscuelaRepository, "findRespuestas").mockResolvedValue([]);
    const res = await request(app).get(URL).set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.data.salas).toEqual([]);
    expect(res.body.data.resumen).toEqual({ inicial: null, cierre: null, comparativo: null });
    expect(spyResp).not.toHaveBeenCalled();
  });

  it("escuela_id inválido → 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app).get("/reportes/escuela?escuela_id=no-es-uuid&periodo=2025").set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("periodo fuera de rango o ausente → 400", async () => {
    mockAuthAs("equipo_padi");
    const r1 = await request(app).get(`/reportes/escuela?escuela_id=${ESC}&periodo=1999`).set("Authorization", "Bearer fake-token");
    const r2 = await request(app).get(`/reportes/escuela?escuela_id=${ESC}`).set("Authorization", "Bearer fake-token");
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it("escuela inexistente → 404", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ReporteEscuelaRepository, "findEscuela").mockResolvedValue(null);
    const res = await request(app).get(URL).set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Escuela no encontrada");
  });

  it.each(["director", "encargado_zona", "docente"])("%s → 403 (requireRole)", async (rol) => {
    mockAuthAs(rol);
    const res = await request(app).get(URL).set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("error del repositorio → 500 con commonResponse", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(ReporteEscuelaRepository, "findEscuela").mockRejectedValue(new Error("boom"));
    const res = await request(app).get(URL).set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, message: "Error interno del servidor" });
  });
});
