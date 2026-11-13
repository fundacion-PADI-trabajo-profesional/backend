import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { mockAuthAs } from "./helpers/auth-mock";

/**
 * Alcance del listado GET /evaluaciones para el rol docente.
 *
 * Regresión (devolución de usuarias, 4/11/2026): una docente veía en "Estudiantes" el estado de una
 * evaluación tomada por su compañera de sala, pero en "Evaluaciones" sólo le figuraban las que ella
 * misma había creado. El frontend mandaba `profesorId` y el backend lo combinaba con AND con sus aulas.
 *
 * Acá no se mockea el repositorio: se verifica el `where` que llega a Prisma.
 */
const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

function docenteConAulas(aulas: string[]) {
  const { prismaMock } = mockAuthAs("docente", "docente-1");
  prismaMock.profesoresAulas.findMany = vi.fn().mockResolvedValue(aulas.map((aula_id) => ({ aula_id })));
  const findMany = vi.fn().mockResolvedValue([]);
  prismaMock.evaluacionEstudiante = { findMany };
  return findMany;
}

describe("GET /evaluaciones — alcance del docente", () => {
  it("con aulas activas ve las evaluaciones de sus aulas (de cualquier docente) más las propias", async () => {
    const findMany = docenteConAulas(["aula-1", "aula-2"]);

    const res = await request(app).get("/evaluaciones").set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ aula_id: { in: ["aula-1", "aula-2"] } }, { profesor_id: "docente-1" }]);
    expect(where.profesor_id).toBeUndefined();
    expect(where.aula_id).toBeUndefined();
  });

  it("ignora el profesorId de la query: no restringe a las propias ni permite pedir las de otro", async () => {
    const findMany = docenteConAulas(["aula-1"]);

    for (const profesorId of ["docente-1", "otro-docente"]) {
      findMany.mockClear();
      const res = await request(app)
        .get(`/evaluaciones?profesorId=${profesorId}`)
        .set("Authorization", "Bearer fake-token");

      expect(res.status).toBe(200);
      const where = findMany.mock.calls[0][0].where;
      expect(where.profesor_id).toBeUndefined();
      expect(where.OR).toEqual([{ aula_id: { in: ["aula-1"] } }, { profesor_id: "docente-1" }]);
    }
  });

  it("mantiene los demás filtros (estudianteId) junto con el alcance", async () => {
    const findMany = docenteConAulas(["aula-1"]);

    await request(app).get("/evaluaciones?estudianteId=s1").set("Authorization", "Bearer fake-token");

    const where = findMany.mock.calls[0][0].where;
    expect(where.estudiante_id).toBe("s1");
    expect(where.OR).toHaveLength(2);
  });

  it("sin aulas asignadas sólo ve las propias, aunque pida las de otro", async () => {
    const findMany = docenteConAulas([]);

    await request(app).get("/evaluaciones?profesorId=otro-docente").set("Authorization", "Bearer fake-token");

    const where = findMany.mock.calls[0][0].where;
    expect(where.profesor_id).toBe("docente-1");
    expect(where.OR).toBeUndefined();
  });
});
