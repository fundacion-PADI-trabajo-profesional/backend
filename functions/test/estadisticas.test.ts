import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EstadisticasRepository } from "../src/repositories/estadisticas.repository";
import { mockAuthAs } from "./helpers/auth-mock";
import { clearStatsCache } from "../src/services/estadisticas.service";

const app = createApp();
beforeEach(() => clearStatsCache());
afterEach(() => vi.restoreAllMocks());

const AREAS = [{ id: "A1", nombre: "Área 1", orden: 1 }];
const REGLAS = [{ area_id: "A1", sala_id: 3, puntaje_total: 10 }];

function mkEval(overrides: Record<string, any> = {}) {
  return {
    id: "ev-1",
    aula_id: "aula-1",
    sala_id: 3,
    aulas: {
      id: "aula-1",
      comision: "A",
      turno: "mañana",
      escuela_id: "esc-1",
      escuela: {
        id: "esc-1",
        nombre: "Escuela Norte",
        zona_id: "zona-1",
        zona: { id: "zona-1", nombre: "Zona Norte" },
      },
    },
    estudiantes: {
      escuela_id: "esc-1",
      escuela: {
        id: "esc-1",
        nombre: "Escuela Norte",
        zona_id: "zona-1",
        zona: { id: "zona-1", nombre: "Zona Norte" },
      },
    },
    evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 8 }],
    ...overrides,
  };
}

// ─── /estadisticas/padi/heatmap-zonas ────────────────────────────────────────
describe("GET /estadisticas/padi/heatmap-zonas", () => {
  it("equipo_padi recibe heatmap 200 con porcentaje correcto", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas).toHaveLength(1);
    expect(res.body.data.filas).toHaveLength(1);
    expect(res.body.data.filas[0].nombre).toBe("Zona Norte");
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBeCloseTo(0.8);
    expect(res.body.data.filas[0].valores.A1.evaluaciones).toBe(1);
    expect(res.body.data.total_evaluaciones).toBe(1);
  });

  it("director recibe 403 (requireRole middleware)", async () => {
    mockAuthAs("director");
    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("periodo no numérico devuelve 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=abc&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("tipo inválido devuelve 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=medio")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("sin tipo devuelve 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("puntaje null → porcentaje null para esa área", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: null }] }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBeNull();
  });

  it("puntaje > max → porcentaje clampado a 1", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 15 }] }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBe(1);
  });

  it("sin evaluaciones → filas vacías, total_evaluaciones 0", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas).toHaveLength(0);
    expect(res.body.data.total_evaluaciones).toBe(0);
  });

  it("eval sin zona → ignorada en filas", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ aulas: null, estudiantes: { escuela_id: null, escuela: null } }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas).toHaveLength(0);
  });

  it("sin regla de aprobación → porcentaje null en todas las áreas", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue([] as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBeNull();
  });

  it("incluye área con porcentaje null cuando fila existe pero no tiene datos para esa área", async () => {
    mockAuthAs("equipo_padi");
    const areas = [
      { id: "A1", nombre: "Área 1", orden: 1 },
      { id: "A2", nombre: "Área 2", orden: 2 },
    ];
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(areas as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/padi/heatmap-zonas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    // A1 tiene datos, A2 no → debe aparecer con porcentaje null
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBeCloseTo(0.8);
    expect(res.body.data.filas[0].valores.A2.porcentaje).toBeNull();
    expect(res.body.data.filas[0].valores.A2.evaluaciones).toBe(0);
  });
});

// ─── /estadisticas/zona/heatmap-escuelas ─────────────────────────────────────
describe("GET /estadisticas/zona/heatmap-escuelas", () => {
  it("encargado_zona con zona asignada recibe 200", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/zona/heatmap-escuelas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].nombre).toBe("Escuela Norte");
    expect(res.body.data.filas[0].meta?.zona_nombre).toBe("Zona Norte");
  });

  it("encargado sin zona asignada → 403", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue(null);
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/zona/heatmap-escuelas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("equipo_padi → 403 (requireRole middleware)", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/zona/heatmap-escuelas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("params inválidos → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/zona/heatmap-escuelas?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("eval sin escuela → ignorada en filas", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ aulas: null, estudiantes: { escuela_id: null, escuela: null } }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/zona/heatmap-escuelas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas).toHaveLength(0);
  });
});

// ─── /estadisticas/escuela/heatmap-aulas ─────────────────────────────────────
describe("GET /estadisticas/escuela/heatmap-aulas", () => {
  it("director con escuela recibe 200 con nombre de aula", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].nombre).toBe("Sala 3 - A - mañana");
    expect(res.body.data.filas[0].meta?.comision).toBe("A");
    expect(res.body.data.filas[0].meta?.turno).toBe("mañana");
  });

  it("director sin escuela_id → 400", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(400);
  });

  it("encargado_zona sin escuela_id → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("eval sin aula → ignorada en nivel aula", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ aula_id: null, aulas: null }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas).toHaveLength(0);
  });

  it("sin regla de aprobación → porcentaje null", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue([] as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([mkEval()] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBeNull();
  });

  it("puntaje > max → porcentaje clampado a 1", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 999 }] }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/heatmap-aulas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.filas[0].valores.A1.porcentaje).toBe(1);
  });
});

// ─── /estadisticas/zona/estudiantes-en-riesgo ────────────────────────────────
describe("GET /estadisticas/zona/estudiantes-en-riesgo", () => {
  function mkEvalRiesgo(overrides: Record<string, any> = {}) {
    return {
      id: "ev-1",
      sala_id: 3,
      aula_id: "aula-1",
      estudiante_id: "est-1",
      aulas: {
        escuela: {
          id: "esc-1",
          nombre: "Escuela Norte",
          zona: { nombre: "Zona Norte" },
        },
      },
      estudiantes: {
        escuela_id: "esc-1",
        escuela: {
          id: "esc-1",
          nombre: "Escuela Norte",
          zona: { nombre: "Zona Norte" },
        },
        personas: { nombre: "Juan", primer_apellido: "García" },
      },
      evaluaciones_estudiante_area: [
        { area_id: "A1", puntaje: 3 }, // 30% < 50% → en riesgo
        { area_id: "A2", puntaje: 4 }, // 40% < 50% → en riesgo
      ],
      ...overrides,
    };
  }

  const AREAS_2 = [
    { id: "A1", nombre: "Área 1", orden: 1 },
    { id: "A2", nombre: "Área 2", orden: 2 },
  ];
  const REGLAS_2 = [
    { area_id: "A1", sala_id: 3, puntaje_total: 10 },
    { area_id: "A2", sala_id: 3, puntaje_total: 10 },
  ];

  it("encargado_zona recibe estudiantes en riesgo 200", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([mkEvalRiesgo()] as any);

    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.estudiantes).toHaveLength(1);
    expect(res.body.data.estudiantes[0].nombre).toBe("Juan");
    expect(res.body.data.estudiantes[0].primer_apellido).toBe("García");
    expect(res.body.data.estudiantes[0].total_areas_en_riesgo).toBe(2);
    expect(res.body.data.estudiantes[0].areas_en_riesgo[0].porcentaje).toBeCloseTo(0.3);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.umbral).toBe(0.5);
  });

  it("umbral personalizado filtra correctamente", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    // puntaje 6/10 = 60% — bajo umbral=0.7 es riesgo, bajo umbral=0.5 no
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([
      mkEvalRiesgo({
        evaluaciones_estudiante_area: [
          { area_id: "A1", puntaje: 6 },
          { area_id: "A2", puntaje: 6 },
        ],
      }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025&umbral=0.7")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.estudiantes).toHaveLength(1);
    expect(res.body.data.umbral).toBe(0.7);
  });

  it("estudiante con solo 1 área en riesgo no aparece", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([
      mkEvalRiesgo({
        evaluaciones_estudiante_area: [
          { area_id: "A1", puntaje: 3 }, // 30% < 50% → riesgo
          { area_id: "A2", puntaje: 8 }, // 80% → OK
        ],
      }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.estudiantes).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it("encargado sin zona → 403", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue(null);
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("equipo_padi → 403", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("periodo inválido → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=nope")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("áreas ordenadas por porcentaje ascendente (peor primero)", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([
      mkEvalRiesgo({
        evaluaciones_estudiante_area: [
          { area_id: "A1", puntaje: 4 }, // 40%
          { area_id: "A2", puntaje: 2 }, // 20%
        ],
      }),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/zona/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    const areas = res.body.data.estudiantes[0].areas_en_riesgo;
    expect(areas[0].porcentaje).toBeCloseTo(0.2); // A2 primero (peor)
    expect(areas[1].porcentaje).toBeCloseTo(0.4); // A1 segundo
  });
});

// ─── /estadisticas/escuela/estudiantes-en-riesgo ─────────────────────────────
describe("GET /estadisticas/escuela/estudiantes-en-riesgo", () => {
  function mkEvalRiesgoEsc(overrides: Record<string, any> = {}) {
    return {
      id: "ev-1",
      sala_id: 3,
      aula_id: "aula-1",
      estudiante_id: "est-1",
      aulas: {
        escuela: { id: "esc-1", nombre: "Escuela Norte", zona: { nombre: "Zona Norte" } },
      },
      estudiantes: {
        escuela_id: "esc-1",
        escuela: { id: "esc-1", nombre: "Escuela Norte", zona: { nombre: "Zona Norte" } },
        personas: { nombre: "Ana", primer_apellido: "López" },
      },
      evaluaciones_estudiante_area: [
        { area_id: "A1", puntaje: 2 },
        { area_id: "A2", puntaje: 3 },
      ],
      ...overrides,
    };
  }

  const AREAS_2 = [
    { id: "A1", nombre: "Área 1", orden: 1 },
    { id: "A2", nombre: "Área 2", orden: 2 },
  ];
  const REGLAS_2 = [
    { area_id: "A1", sala_id: 3, puntaje_total: 10 },
    { area_id: "A2", sala_id: 3, puntaje_total: 10 },
  ];

  it("director con escuela recibe 200", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([mkEvalRiesgoEsc()] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.estudiantes[0].nombre).toBe("Ana");
    expect(res.body.data.estudiantes[0].total_areas_en_riesgo).toBe(2);
  });

  it("director sin escuela_id → 400", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(400);
  });

  it("encargado_zona sin escuela_id → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/escuela/estudiantes-en-riesgo?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("sin periodo → 400", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    const res = await request(app)
      .get("/estadisticas/escuela/estudiantes-en-riesgo")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("umbral inválido usa 0.5 por defecto", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_2 as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaRiesgo").mockResolvedValue([mkEvalRiesgoEsc()] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/estudiantes-en-riesgo?periodo=2025&umbral=2")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.umbral).toBe(0.5);
  });
});

// ─── E3 EVOLUCIÓN ─────────────────────────────────────────────────────────────
const AREAS_EVO = [
  { id: "A1", nombre: "Área 1", orden: 1 },
  { id: "A2", nombre: "Área 2", orden: 2 },
];
const REGLAS_EVO = [
  { area_id: "A1", sala_id: 3, puntaje_total: 10 },
  { area_id: "A2", sala_id: 3, puntaje_total: 10 },
];

function mkEvalEvo(tipo: "inicial" | "final", puntajeA1: number, puntajeA2: number) {
  return {
    id: `ev-${tipo}`,
    aula_id: "aula-1",
    sala_id: 3,
    aulas: {
      id: "aula-1", comision: "A", turno: "mañana", escuela_id: "esc-1",
      escuela: { id: "esc-1", nombre: "Esc Norte", zona_id: "z1", zona: { id: "z1", nombre: "Zona Norte" } },
    },
    estudiantes: {
      escuela_id: "esc-1",
      escuela: { id: "esc-1", nombre: "Esc Norte", zona_id: "z1", zona: { id: "z1", nombre: "Zona Norte" } },
    },
    evaluaciones_estudiante_area: [
      { area_id: "A1", puntaje: puntajeA1 },
      { area_id: "A2", puntaje: puntajeA2 },
    ],
  };
}

describe("GET /estadisticas/padi/evolucion", () => {
  it("equipo_padi recibe evolución 200 con delta correcto", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([mkEvalEvo("inicial", 5, 6)] as any)  // inicial: A1=50%, A2=60%
      .mockResolvedValueOnce([mkEvalEvo("final", 7, 8)] as any);   // final: A1=70%, A2=80%

    const res = await request(app)
      .get("/estadisticas/padi/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas).toHaveLength(2);
    const a1 = res.body.data.areas.find((a: any) => a.area_id === "A1");
    expect(a1.pct_inicial).toBeCloseTo(0.5);
    expect(a1.pct_final).toBeCloseTo(0.7);
    expect(a1.delta).toBeCloseTo(0.2);
  });

  it("encargado_zona → 403", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/padi/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("periodo inválido → 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/padi/evolucion?periodo=abc")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("sin datos en final → delta null", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([mkEvalEvo("inicial", 5, 6)] as any)
      .mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/estadisticas/padi/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas[0].delta).toBeNull();
    expect(res.body.data.areas[0].pct_final).toBeNull();
  });
});

describe("GET /estadisticas/zona/evolucion", () => {
  it("encargado_zona con zona recibe 200", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([mkEvalEvo("inicial", 4, 5)] as any)
      .mockResolvedValueOnce([mkEvalEvo("final", 6, 8)] as any);

    const res = await request(app)
      .get("/estadisticas/zona/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas[0].delta).toBeCloseTo(0.2);
  });

  it("encargado sin zona → 403", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue(null);
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([] as any).mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/estadisticas/zona/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("director → 403", async () => {
    mockAuthAs("director");
    const res = await request(app)
      .get("/estadisticas/zona/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("GET /estadisticas/escuela/evolucion", () => {
  it("director con escuela recibe 200", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([mkEvalEvo("inicial", 3, 4)] as any)
      .mockResolvedValueOnce([mkEvalEvo("final", 7, 9)] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas).toHaveLength(2);
  });

  it("director sin escuela → 403", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([] as any).mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/evolucion?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

// ─── E4 ÁREAS CRÍTICAS ────────────────────────────────────────────────────────
describe("GET /estadisticas/padi/areas-criticas", () => {
  it("equipo_padi recibe áreas ordenadas de peor a mejor", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      { ...mkEvalEvo("inicial", 3, 8), id: "ev-1" }, // A1=30%, A2=80%
    ] as any);

    const res = await request(app)
      .get("/estadisticas/padi/areas-criticas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas[0].area_id).toBe("A1"); // A1 es el peor (30%)
    expect(res.body.data.areas[0].porcentaje_promedio).toBeCloseTo(0.3);
    expect(res.body.data.areas[1].porcentaje_promedio).toBeCloseTo(0.8);
  });

  it("tipo inválido → 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/padi/areas-criticas?periodo=2025&tipo=malo")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("encargado_zona → 403", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/padi/areas-criticas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("área sin datos → porcentaje_promedio null, aparece al final", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      { ...mkEvalEvo("inicial", 3, 3), evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 3 }] },
    ] as any);

    const res = await request(app)
      .get("/estadisticas/padi/areas-criticas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    const areas = res.body.data.areas;
    expect(areas[areas.length - 1].porcentaje_promedio).toBeNull();
  });
});

describe("GET /estadisticas/zona/areas-criticas", () => {
  it("encargado_zona con zona recibe 200", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEvalEvo("inicial", 4, 9),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/zona/areas-criticas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas[0].area_id).toBe("A1"); // 40% < 90%
  });

  it("equipo_padi → 403", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .get("/estadisticas/zona/areas-criticas?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("GET /estadisticas/escuela/areas-criticas", () => {
  it("director con escuela recibe 200", async () => {
    mockAuthAs("director", "u-1", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([
      mkEvalEvo("final", 2, 7),
    ] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/areas-criticas?periodo=2025&tipo=cierre")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.tipo).toBe("cierre");
    expect(res.body.data.areas[0].area_id).toBe("A1"); // 20% < 70%
  });

  it("director sin escuela → 400", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS_EVO as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([] as any);

    const res = await request(app)
      .get("/estadisticas/escuela/areas-criticas?periodo=2025&tipo=final")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("encargado_zona sin escuela_id → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/escuela/areas-criticas?periodo=2025&tipo=final")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

// ─── /estadisticas/docente/items-error ───────────────────────────────────────
const RESPUESTAS_FIXTURE = [
  {
    evaluaciones_estudiante_area: [
      {
        evaluaciones_estudiante_area_preguntas: [
          {
            pregunta_id: "P1",
            respuesta: 0,
            preguntas: { id: "P1", consigna: "¿Qué color es el cielo?", titulo: null, area_id: "A1" },
          },
          {
            pregunta_id: "P2",
            respuesta: 1,
            preguntas: { id: "P2", consigna: "¿Cuánto es 2+2?", titulo: null, area_id: "A1" },
          },
        ],
      },
    ],
  },
  {
    evaluaciones_estudiante_area: [
      {
        evaluaciones_estudiante_area_preguntas: [
          {
            pregunta_id: "P1",
            respuesta: 0,
            preguntas: { id: "P1", consigna: "¿Qué color es el cielo?", titulo: null, area_id: "A1" },
          },
        ],
      },
    ],
  },
];

describe("GET /estadisticas/docente/aprobacion-preguntas", () => {
  it("docente con aula propia recibe aprobación por pregunta", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockResolvedValue(true);
    vi.spyOn(EstadisticasRepository, "findRespuestasPorAula").mockResolvedValue(RESPUESTAS_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/docente/aprobacion-preguntas?periodo=2025&aula_id=aula-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    // P1 tiene 0/2 correctos → tasa_aprobacion 0.0 (peor primero); P2 tiene 1/1 → tasa 1.0
    expect(res.body.data.items[0].pregunta_id).toBe("P1");
    expect(res.body.data.items[0].tasa_aprobacion).toBeCloseTo(0.0);
    expect(res.body.data.items[1].tasa_aprobacion).toBeCloseTo(1.0);
  });

  it("docente sin acceso al aula → 403", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockResolvedValue(false);

    const res = await request(app)
      .get("/estadisticas/docente/aprobacion-preguntas?periodo=2025&aula_id=aula-ajena")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("docente sin perfil de profesor → 403", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue(null);

    const res = await request(app)
      .get("/estadisticas/docente/aprobacion-preguntas?periodo=2025&aula_id=aula-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("falta aula_id → 400", async () => {
    mockAuthAs("docente");
    const res = await request(app)
      .get("/estadisticas/docente/aprobacion-preguntas?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("director puede acceder con aula_id → 200 (acceso jerárquico)", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findRespuestasPorAula").mockResolvedValue(RESPUESTAS_FIXTURE as any);
    const res = await request(app)
      .get("/estadisticas/docente/aprobacion-preguntas?periodo=2025&aula_id=aula-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });
});

// ─── /estadisticas/docente/distribucion-puntajes ─────────────────────────────
const EVALS_DIST = [
  { id: "ev-1", sala_id: 3, estudiante_id: "est-1", evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 9 }] },
  { id: "ev-2", sala_id: 3, estudiante_id: "est-2", evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 4 }] },
  { id: "ev-3", sala_id: 3, estudiante_id: "est-3", evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 1 }] },
];

describe("GET /estadisticas/docente/distribucion-puntajes", () => {
  it("docente recibe distribución correcta de 3 estudiantes", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockResolvedValue(true);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaAula").mockResolvedValue(EVALS_DIST as any);

    const res = await request(app)
      .get("/estadisticas/docente/distribucion-puntajes?periodo=2025&aula_id=aula-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.total_estudiantes).toBe(3);
    expect(res.body.data.rangos).toHaveLength(5);
    // est-1: 9/10 = 90% → rango 81-100% (idx 4)
    expect(res.body.data.rangos[4].cantidad).toBe(1);
    // est-2: 4/10 = 40% → rango 21-40% (idx 1)
    expect(res.body.data.rangos[1].cantidad).toBe(1);
    // est-3: 1/10 = 10% → rango 0-20% (idx 0)
    expect(res.body.data.rangos[0].cantidad).toBe(1);
  });

  it("docente sin acceso al aula → 403", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockResolvedValue(false);

    const res = await request(app)
      .get("/estadisticas/docente/distribucion-puntajes?periodo=2025&aula_id=aula-ajena")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("falta aula_id → 400", async () => {
    mockAuthAs("docente");
    const res = await request(app)
      .get("/estadisticas/docente/distribucion-puntajes?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

// ─── /estadisticas/zona/actividad-docentes ────────────────────────────────────
const ACTIVIDAD_FIXTURE = [
  { profesor_id: "p-1", profesores: { personas: { nombre: "Ana", primer_apellido: "García" } } },
  { profesor_id: "p-1", profesores: { personas: { nombre: "Ana", primer_apellido: "García" } } },
  { profesor_id: "p-2", profesores: { personas: { nombre: "Luis", primer_apellido: "López" } } },
];

describe("GET /estadisticas/zona/actividad-docentes", () => {
  it("encargado_zona recibe listado ordenado por evaluaciones", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findActividadDocentes").mockResolvedValue(ACTIVIDAD_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/zona/actividad-docentes?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.docentes).toHaveLength(2);
    expect(res.body.data.docentes[0].total_evaluaciones).toBe(2); // Ana tiene 2
    expect(res.body.data.docentes[0].nombre).toBe("Ana");
  });

  it("encargado sin zona → 403", async () => {
    mockAuthAs("encargado_zona");
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEncargado").mockResolvedValue(null);
    const res = await request(app)
      .get("/estadisticas/zona/actividad-docentes?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("director → 403", async () => {
    mockAuthAs("director");
    const res = await request(app)
      .get("/estadisticas/zona/actividad-docentes?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

describe("GET /estadisticas/escuela/actividad-docentes", () => {
  it("director recibe actividad de su escuela", async () => {
    mockAuthAs("director", "test-user-id", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findActividadDocentes").mockResolvedValue(ACTIVIDAD_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/escuela/actividad-docentes?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.docentes).toHaveLength(2);
  });

  it("director sin escuela → 400", async () => {
    mockAuthAs("director");
    vi.spyOn(EstadisticasRepository, "findActividadDocentes").mockResolvedValue([] as any);
    const res = await request(app)
      .get("/estadisticas/escuela/actividad-docentes?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

// ─── /estadisticas/padi/cobertura-por-zona ───────────────────────────────────
const COBERTURA_FIXTURE = [
  {
    estudiante_id: "est-1",
    aulas: { escuela: { zona_id: "z1", zona: { id: "z1", nombre: "Zona Norte" } } },
    estudiantes: { escuela: null },
  },
  {
    estudiante_id: "est-2",
    aulas: { escuela: { zona_id: "z1", zona: { id: "z1", nombre: "Zona Norte" } } },
    estudiantes: { escuela: null },
  },
  {
    estudiante_id: "est-1",
    aulas: { escuela: { zona_id: "z1", zona: { id: "z1", nombre: "Zona Norte" } } },
    estudiantes: { escuela: null },
  },
];

describe("GET /estadisticas/padi/cobertura-por-zona", () => {
  it("equipo_padi recibe cobertura con estudiantes únicos", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EstadisticasRepository, "findEvaluacionesPorZona").mockResolvedValue(COBERTURA_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/padi/cobertura-por-zona?periodo=2025")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.zonas).toHaveLength(1);
    expect(res.body.data.zonas[0].evaluaciones).toBe(3);
    expect(res.body.data.zonas[0].estudiantes_evaluados).toBe(2); // est-1 duplicado
    expect(res.body.data.total_evaluaciones).toBe(3);
    expect(res.body.data.total_estudiantes_evaluados).toBe(2);
  });

  it("encargado_zona → 403", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/padi/cobertura-por-zona?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});

// ─── /estadisticas/escuela/comparativa ───────────────────────────────────────
describe("GET /estadisticas/escuela/comparativa", () => {
  it("director recibe comparativa escuela/zona/nacional por área", async () => {
    mockAuthAs("director", "test-user-id", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findZonaIdDeEscuela").mockResolvedValue("zona-1");
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap")
      .mockResolvedValueOnce([mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 9 }] })] as any) // escuela
      .mockResolvedValueOnce([mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 7 }] })] as any) // zona
      .mockResolvedValueOnce([mkEval({ evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 5 }] })] as any); // nacional

    const res = await request(app)
      .get("/estadisticas/escuela/comparativa?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.areas).toHaveLength(1);
    expect(res.body.data.areas[0].pct_escuela).toBeCloseTo(0.9);
    expect(res.body.data.areas[0].pct_zona).toBeCloseTo(0.7);
    expect(res.body.data.areas[0].pct_nacional).toBeCloseTo(0.5);
  });

  it("falta tipo → 400", async () => {
    mockAuthAs("director", "test-user-id", { escuela_id: "esc-1" });
    const res = await request(app)
      .get("/estadisticas/escuela/comparativa?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("encargado_zona sin escuela_id → 400", async () => {
    mockAuthAs("encargado_zona");
    const res = await request(app)
      .get("/estadisticas/escuela/comparativa?periodo=2025&tipo=inicial")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

// ─── /estadisticas/docente/progresion-estudiante ─────────────────────────────
const PROGRESION_FIXTURE = [
  {
    id: "ev-1", sala_id: 3, tipo_id: "inicial", fecha_creacion: new Date("2025-03-01"),
    evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 6 }],
  },
  {
    id: "ev-2", sala_id: 3, tipo_id: "final", fecha_creacion: new Date("2025-10-01"),
    evaluaciones_estudiante_area: [{ area_id: "A1", puntaje: 9 }],
  },
];

describe("GET /estadisticas/docente/progresion-estudiante", () => {
  it("docente recibe progresión de estudiante en su aula", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findEstudianteEnAulasDeProfesor").mockResolvedValue({
      nombre: "Juan", primer_apellido: "García",
    });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findUltimasEvaluaciones").mockResolvedValue(PROGRESION_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/docente/progresion-estudiante?estudiante_id=est-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe("Juan");
    expect(res.body.data.areas).toHaveLength(1);
    expect(res.body.data.areas[0].evaluaciones).toHaveLength(2);
    expect(res.body.data.areas[0].evaluaciones[0].pct).toBeCloseTo(0.6);
    expect(res.body.data.areas[0].evaluaciones[1].pct).toBeCloseTo(0.9);
  });

  it("estudiante no en sus aulas → 403", async () => {
    mockAuthAs("docente");
    vi.spyOn(EstadisticasRepository, "findProfesorIdDeUsuario").mockResolvedValue("prof-1");
    vi.spyOn(EstadisticasRepository, "findEstudianteEnAulasDeProfesor").mockResolvedValue(null);
    const res = await request(app)
      .get("/estadisticas/docente/progresion-estudiante?periodo=2025&estudiante_id=est-x")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("falta estudiante_id → 400", async () => {
    mockAuthAs("docente");
    const res = await request(app)
      .get("/estadisticas/docente/progresion-estudiante?periodo=2025")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

describe("GET /estadisticas/escuela/progresion-estudiante", () => {
  it("director recibe progresión de estudiante en su escuela", async () => {
    mockAuthAs("director", "test-user-id", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findEstudianteEnEscuela").mockResolvedValue({
      nombre: "María", primer_apellido: "Torres",
    });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue(REGLAS as any);
    vi.spyOn(EstadisticasRepository, "findUltimasEvaluaciones").mockResolvedValue(PROGRESION_FIXTURE as any);

    const res = await request(app)
      .get("/estadisticas/escuela/progresion-estudiante?estudiante_id=est-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe("María");
    expect(res.body.data.areas[0].evaluaciones[0].tipo).toBe("inicial");
  });

  it("estudiante no en la escuela → 403", async () => {
    mockAuthAs("director", "test-user-id", { escuela_id: "esc-1" });
    vi.spyOn(EstadisticasRepository, "findEstudianteEnEscuela").mockResolvedValue(null);
    const res = await request(app)
      .get("/estadisticas/escuela/progresion-estudiante?periodo=2025&estudiante_id=est-x")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });
});
