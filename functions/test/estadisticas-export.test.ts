import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EstadisticasRepository } from "../src/repositories/estadisticas.repository";
import { mockAuthAs } from "./helpers/auth-mock";
import { clearStatsCache } from "../src/services/estadisticas.service";

const app = createApp();
beforeEach(() => clearStatsCache());
afterEach(() => vi.restoreAllMocks());

const AREAS = [
  { id: "MOT", nombre: "Motricidad", orden: 1 },
  { id: "LEN", nombre: "Lenguaje", orden: 2 },
];

const REGLAS = [
  { area_id: "MOT", sala_id: 5, aprueba_con: 7, puntaje_total: 10, salas: { nombre: "Sala 5" } },
  { area_id: "LEN", sala_id: 5, aprueba_con: 5, puntaje_total: 8, salas: { nombre: "Sala 5" } },
];

function mkEvalExport(overrides: Record<string, any> = {}) {
  return {
    id: "ev-1",
    estudiante_id: "est-1",
    sala_id: 5,
    tipo_id: "inicial",
    estado_id: "A",
    fecha_creacion: new Date("2025-04-12T15:00:00Z"),
    salas: { nombre: "Sala 5" },
    aulas: { comision: "A", turno: "Mañana" },
    estudiantes: {
      personas: { nombre: "Juan", primer_apellido: "Pérez", segundo_apellido: null, dni: "45123456" },
      escuela: { nombre: "Esc. 12", zona: { nombre: "Norte" } },
      aulas: [{ aula: { comision: "B", turno: "Tarde" } }],
    },
    evaluaciones_estudiante_area: [
      { area_id: "MOT", puntaje: 8, estado_id: "A", observacion: null },
      { area_id: "LEN", puntaje: 4, estado_id: "D", observacion: "necesita apoyo" },
    ],
    ...overrides,
  };
}

function mkEstudiante(overrides: Record<string, any> = {}) {
  return {
    id: "est-1",
    sala_id: 5,
    salas: { nombre: "Sala 5" },
    personas: { nombre: "Juan", primer_apellido: "Pérez", segundo_apellido: null, dni: "45123456" },
    escuela: { nombre: "Esc. 12", zona: { nombre: "Norte" } },
    aulas: [{ aula: { comision: "B", turno: "Tarde" } }],
    ...overrides,
  };
}

function mockRepos(opts: { evaluaciones?: any[]; estudiantes?: any[] } = {}) {
  vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue(AREAS as any);
  vi.spyOn(EstadisticasRepository, "findReglasParaExport").mockResolvedValue(REGLAS as any);
  vi.spyOn(EstadisticasRepository, "findEvaluacionesParaExport").mockResolvedValue(
    (opts.evaluaciones ?? []) as any
  );
  vi.spyOn(EstadisticasRepository, "findEstudiantesActivosParaExport").mockResolvedValue(
    (opts.estudiantes ?? []) as any
  );
}

const getExport = (qs: string) =>
  request(app)
    .get(`/estadisticas/padi/export-evaluaciones${qs}`)
    .set("Authorization", "Bearer fake-token");

describe("GET /estadisticas/padi/export-evaluaciones", () => {
  it("mapea una evaluación completa a su fila", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({ evaluaciones: [mkEvalExport()], estudiantes: [mkEstudiante()] });

    const res = await getExport("?periodo=2025");

    expect(res.status).toBe(200);
    expect(res.body.data.periodo).toBe(2025);
    expect(res.body.data.areas).toHaveLength(2);

    const fila = res.body.data.filas.find((f: any) => f.estado === "A");
    expect(fila).toMatchObject({
      zona: "Norte",
      escuela: "Esc. 12",
      sala: "Sala 5",
      aula: "A - Mañana",
      apellido: "Pérez",
      nombre: "Juan",
      dni: "45123456",
      tipo: "inicial",
      estado: "A",
      areas_aprobadas: 1, // MOT=A, LEN=D
    });
    expect(fila.fecha).toBe("2025-04-12T15:00:00.000Z");
    expect(fila.areas).toEqual([
      { area_id: "MOT", aprobadas: 8, total: 10, aprueba_con: 7, estado: "A", observacion: null },
      { area_id: "LEN", aprobadas: 4, total: 8, aprueba_con: 5, estado: "D", observacion: "necesita apoyo" },
    ]);
  });

  it("genera fila sintética sin_evaluar solo para el tipo faltante", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({ evaluaciones: [mkEvalExport()], estudiantes: [mkEstudiante()] });

    const res = await getExport("?periodo=2025");

    const sinEvaluar = res.body.data.filas.filter((f: any) => f.estado === "sin_evaluar");
    expect(sinEvaluar).toHaveLength(1);
    expect(sinEvaluar[0]).toMatchObject({
      tipo: "cierre",
      apellido: "Pérez",
      aula: "B - Tarde", // aula activa actual
      fecha: null,
      areas_aprobadas: null,
      areas: [],
    });
  });

  it("estudiante sin evaluaciones genera sintéticas para ambos tipos", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({ estudiantes: [mkEstudiante()] });

    const res = await getExport("?periodo=2025");

    const tipos = res.body.data.filas.map((f: any) => f.tipo).sort();
    expect(res.body.data.filas).toHaveLength(2);
    expect(tipos).toEqual(["cierre", "inicial"]);
    expect(res.body.data.filas.every((f: any) => f.estado === "sin_evaluar")).toBe(true);
  });

  it("dos evaluaciones del mismo tipo aparecen ambas (sin deduplicar)", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({
      evaluaciones: [mkEvalExport(), mkEvalExport({ id: "ev-2", estado_id: "D" })],
      estudiantes: [mkEstudiante()],
    });

    const res = await getExport("?periodo=2025");

    const iniciales = res.body.data.filas.filter((f: any) => f.tipo === "inicial");
    expect(iniciales).toHaveLength(2);
    // y la sintética de cierre sigue existiendo
    expect(res.body.data.filas.filter((f: any) => f.estado === "sin_evaluar")).toHaveLength(1);
  });

  it("evaluación en progreso tiene areas_aprobadas null", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({ evaluaciones: [mkEvalExport({ estado_id: "E" })], estudiantes: [] });

    const res = await getExport("?periodo=2025");

    expect(res.body.data.filas[0].estado).toBe("E");
    expect(res.body.data.filas[0].areas_aprobadas).toBeNull();
  });

  it("sin regla para la sala, total y aprueba_con van null", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({
      evaluaciones: [mkEvalExport({ sala_id: 3, salas: { nombre: "Sala 3" } })],
      estudiantes: [],
    });

    const res = await getExport("?periodo=2025");

    const area = res.body.data.filas[0].areas[0];
    expect(area.aprobadas).toBe(8);
    expect(area.total).toBeNull();
    expect(area.aprueba_con).toBeNull();
  });

  it("evaluación sin aula usa el aula activa del estudiante", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({ evaluaciones: [mkEvalExport({ aulas: null })], estudiantes: [] });

    const res = await getExport("?periodo=2025");

    expect(res.body.data.filas[0].aula).toBe("B - Tarde");
  });

  it("ordena por escuela y dentro del alumno inicial antes que cierre", async () => {
    mockAuthAs("equipo_padi");
    const evB = mkEvalExport({
      id: "ev-b",
      estudiante_id: "est-2",
      estudiantes: {
        ...mkEvalExport().estudiantes,
        escuela: { nombre: "Aardvark School", zona: { nombre: "Sur" } },
      },
    });
    const cierre = mkEvalExport({ id: "ev-c", tipo_id: "cierre" });
    mockRepos({ evaluaciones: [cierre, mkEvalExport(), evB], estudiantes: [] });

    const res = await getExport("?periodo=2025");

    const filas = res.body.data.filas;
    expect(filas[0].escuela).toBe("Aardvark School");
    expect(filas[1].tipo).toBe("inicial");
    expect(filas[2].tipo).toBe("cierre");
  });

  it("devuelve el catálogo de reglas con nombre de sala", async () => {
    mockAuthAs("equipo_padi");
    mockRepos({});

    const res = await getExport("?periodo=2025");

    expect(res.body.data.reglas).toEqual([
      { sala: "Sala 5", area_id: "MOT", aprueba_con: 7, puntaje_total: 10 },
      { sala: "Sala 5", area_id: "LEN", aprueba_con: 5, puntaje_total: 8 },
    ]);
  });

  it("director recibe 403 (requireRole middleware)", async () => {
    mockAuthAs("director");
    const res = await getExport("?periodo=2025");
    expect(res.status).toBe(403);
  });

  it("periodo no numérico devuelve 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await getExport("?periodo=abc");
    expect(res.status).toBe(400);
  });

  it("sin periodo devuelve 400", async () => {
    mockAuthAs("equipo_padi");
    const res = await getExport("");
    expect(res.status).toBe(400);
  });
});
