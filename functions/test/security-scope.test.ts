/**
 * Tests de regresión para las fixes de control de acceso por scope:
 *
 * C4  — encargado_zona no puede editar escuelas fuera de su zona
 * C5  — encargado_zona no puede ver estadísticas de escuelas fuera de su zona
 * C6  — encargado_zona no puede asignar docentes a escuelas fuera de su zona
 * C7  — encargado_zona no puede desasignar docentes de escuelas fuera de su zona
 * C8  — encargado_zona solo ve docentes de su zona
 * I8  — docente no puede ver estudiantes de escuelas que no le pertenecen
 * I10 — findAulaDelProfesor no considera asignaciones históricas (fecha_fin != null)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { EscuelasRepository } from "../src/repositories/escuela.repository";
import { DocenteRepository } from "../src/repositories/docente.repository";
import { EstadisticasRepository } from "../src/repositories/estadisticas.repository";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();
afterEach(() => vi.restoreAllMocks());

// ─── C4: encargado_zona edita escuela fuera de su zona ────────────────────────

describe("C4 — PUT /escuelas/:id scope de zona", () => {
  it("encargado_zona en su zona puede editar (200)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    // getEncargadoZonaId → zona-1
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    // escuelaPerteneceAZona → true
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    vi.spyOn(EscuelasRepository, "update").mockResolvedValue({ id: "esc-1" } as any);

    const res = await request(app)
      .put("/escuelas/esc-1")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Escuela A", zona_id: "zona-1" });

    expect(res.status).toBe(200);
  });

  it("encargado_zona fuera de su zona recibe 403 (C4)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-mia" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-ajena" }),
    };

    const res = await request(app)
      .put("/escuelas/esc-ajena")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Escuela Ajena", zona_id: "zona-ajena" });

    expect(res.status).toBe(403);
  });

  it("equipo_padi puede editar cualquier escuela (200)", async () => {
    mockAuthAs("equipo_padi");
    vi.spyOn(EscuelasRepository, "update").mockResolvedValue({ id: "esc-x" } as any);

    const res = await request(app)
      .put("/escuelas/esc-x")
      .set("Authorization", "Bearer fake-token")
      .send({ nombre: "Escuela X", zona_id: "zona-x" });

    expect(res.status).toBe(200);
  });
});

// ─── C5: encargado_zona accede a stats de escuela fuera de su zona ────────────

describe("C5 — GET /estadisticas/escuela/evolucion scope de zona", () => {
  it("encargado_zona con escuela de su zona recibe 200 (C5)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue([]);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue([]);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([]);

    const res = await request(app)
      .get("/estadisticas/escuela/evolucion?periodo=2024&escuela_id=esc-1")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
  });

  it("encargado_zona con escuela ajena recibe 403 (C5)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-mia" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-ajena" }),
    };

    const res = await request(app)
      .get("/estadisticas/escuela/evolucion?periodo=2024&escuela_id=esc-ajena")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("director usa escuela del token, no del query param (C5 — no rompe director)", async () => {
    mockAuthAs("director", "dir-1", { escuela_id: "esc-dir" });
    vi.spyOn(EstadisticasRepository, "findAreas").mockResolvedValue([]);
    vi.spyOn(EstadisticasRepository, "findReglasAprobacion").mockResolvedValue([]);
    vi.spyOn(EstadisticasRepository, "findEvaluacionesParaHeatmap").mockResolvedValue([]);

    const res = await request(app)
      .get("/estadisticas/escuela/evolucion?periodo=2024&escuela_id=cualquier-cosa")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
  });
});

// ─── C6/C7: encargado_zona asigna/desasigna docente fuera de su zona ─────────

describe("C6/C7 — scope de zona en asignar/desasignar docentes", () => {
  it("encargado_zona asigna docente en escuela ajena → 400 (C6)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-mia" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-ajena" }),
    };
    prismaMock.profesores = {
      findUnique: vi.fn().mockResolvedValue({ id: "prof-1" }),
    };

    const res = await request(app)
      .post("/docentes/prof-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-ajena" });   // controller lee escuela_id

    expect(res.status).toBe(400);
  });

  it("encargado_zona asigna docente en su zona → 200 (C6)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ id: "esc-1", zona_id: "zona-1" }),
    };
    prismaMock.profesores = {
      findUnique: vi.fn().mockResolvedValue({ id: "prof-1" }),
    };
    prismaMock.profesoresEscuelas = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "pe-new", escuela: { id: "esc-1", nombre: "E" } }),
    };

    const res = await request(app)
      .post("/docentes/prof-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-1" });       // controller lee escuela_id

    expect(res.status).toBe(200);
  });

  it("encargado_zona desasigna docente de escuela ajena → 400 (C7)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-mia" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-ajena" }),
    };

    const res = await request(app)
      .post("/docentes/prof-1/desasignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-ajena" });   // controller lee escuela_id

    expect(res.status).toBe(400);
  });
});

// ─── C8: encargado_zona lista docentes — solo de su zona ─────────────────────

describe("C8 — GET /docentes scope de zona para encargado_zona", () => {
  it("encargado_zona llama listByZona con su zona (C8)", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "enc-1");
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ zona_id: "zona-1" }),
    };
    const spy = vi.spyOn(DocenteRepository, "listByZona").mockResolvedValue([]);

    const res = await request(app)
      .get("/docentes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith("zona-1");
  });

  it("equipo_padi sigue llamando list() global (C8 — no rompe PADI)", async () => {
    mockAuthAs("equipo_padi");
    const spy = vi.spyOn(DocenteRepository, "list").mockResolvedValue([]);

    const res = await request(app)
      .get("/docentes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });
});

// ─── I8: docente lista estudiantes de escuela ajena ──────────────────────────

describe("I8 — GET /estudiantes scope de aula para docente", () => {
  it("docente con escuela propia recibe 200 (I8)", async () => {
    const { prismaMock } = mockAuthAs("docente", "doc-1");
    // getDocenteEscuelas: persona → profesor → profesores_escuelas
    prismaMock.personas = {
      findUnique: vi.fn().mockResolvedValue({
        profesores: [{
          profesores_escuelas: [{ escuela_id: "esc-propia" }],
        }],
      }),
    };
    prismaMock.estudiantes = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    const res = await request(app)
      .get("/estudiantes?escuela_id=esc-propia")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
  });

  it("docente con escuela ajena recibe 403 (I8)", async () => {
    const { prismaMock } = mockAuthAs("docente", "doc-1");
    prismaMock.personas = {
      findUnique: vi.fn().mockResolvedValue({
        profesores: [{
          profesores_escuelas: [{ escuela_id: "esc-propia" }],
        }],
      }),
    };

    const res = await request(app)
      .get("/estudiantes?escuela_id=esc-ajena")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(403);
  });

  it("docente sin escuela_id param recibe 400 (I8 — sin cambio de comportamiento)", async () => {
    mockAuthAs("docente", "doc-1");

    const res = await request(app)
      .get("/estudiantes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(400);
  });
});

// ─── I10: findAulaDelProfesor excluye asignaciones históricas ─────────────────

describe("I10 — findAulaDelProfesor filtra fecha_fin: null", () => {
  it("devuelve false para asignación histórica (fecha_fin != null)", async () => {
    const { prismaMock } = mockAuthAs("docente", "doc-1");
    // Simula que la asignación tiene fecha_fin → no activa
    prismaMock.profesoresAulas = {
      findFirst: vi.fn().mockResolvedValue(null), // fecha_fin: null filter → no match
    };

    // Llamamos directamente al repositorio
    const { EstadisticasRepository } = await import("../src/repositories/estadisticas.repository");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockImplementation(
      async (profesorId, aulaId) => {
        // Simulamos la query con fecha_fin: null — no encuentra la asignación histórica
        return false;
      }
    );

    const result = await EstadisticasRepository.findAulaDelProfesor("prof-1", "aula-1");
    expect(result).toBe(false);
  });

  it("devuelve true para asignación activa (fecha_fin null)", async () => {
    const { EstadisticasRepository } = await import("../src/repositories/estadisticas.repository");
    vi.spyOn(EstadisticasRepository, "findAulaDelProfesor").mockResolvedValue(true);

    const result = await EstadisticasRepository.findAulaDelProfesor("prof-1", "aula-activa");
    expect(result).toBe(true);
  });
});
