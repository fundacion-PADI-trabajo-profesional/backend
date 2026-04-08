import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as prismaClient from "../src/config/prismaClient";
import { EvaluacionRepository } from "../src/repositories/evaluacion.repository";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

describe("health endpoint", () => {
  it("returns ok:true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe("directivos assign escuela endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows encargado_zona to assign escuela to director within same zona", async () => {
    const { prismaMock } = mockAuthAs("encargado_zona", "encargado-user-1");

    // 2. Definimos el mock para la transacción (lo que pasa ADENTRO del servicio)
    const txMock = {
      usuarioPerfil: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({
          id: "dir1",
          nombre: "Juan",
          apellido: "Pérez",
          escuela: { id: "esc1", nombre: "Escuela Norte" },
        }),
      },
    };

    // 3. Inyectamos los mocks específicos de este test en el prismaMock del helper
    prismaMock.encargados = {
      findUnique: vi.fn().mockResolvedValue({ id: "enc1", zona: "Norte" }),
    };
    prismaMock.escuelas = {
      findUnique: vi.fn().mockResolvedValue({ id: "esc1", zona: "Norte" }),
    };
    // Mockeamos el perfil del director al que queremos asignar
    // Conservamos el comportamiento por defecto (perfil del usuario autenticado)
    // y solo devolvemos el director cuando se busca por su id 'dir1'.
    const originalFindUnique = prismaMock.usuarioPerfil.findUnique;
    prismaMock.usuarioPerfil.findUnique = vi.fn().mockImplementation(async (args: any) => {
      if (args && args.where && args.where.id === "dir1") {
        return { id: "dir1", rol: "director" };
      }
      return originalFindUnique(args);
    });

    prismaMock.$transaction = vi.fn().mockImplementation(async (cb: any) => cb(txMock));

    // 4. Realizamos la petición limpia
    const res = await request(app)
      .post("/directivos/dir1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({
        escuela_id: "esc1",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(txMock.usuarioPerfil.update).toHaveBeenCalled();
  });
});

describe("evaluaciones endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty list", async () => {
    mockAuthAs("equipo_padi"); // Necesita estar logueado

    vi.spyOn(EvaluacionRepository, "listWithFilters").mockResolvedValue([]);

    const res = await request(app)
      .get("/evaluaciones")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
  });

  it("returns 404 when not found", async () => {
    mockAuthAs("equipo_padi");

    vi.spyOn(EvaluacionRepository, "findById").mockResolvedValue(null);

    const res = await request(app)
      .get("/evaluaciones/does-not-exist")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(404);
  });
});

describe("zonas encargados endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows equipo_padi to list encargados for zone assignment", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");

    prismaMock.encargados = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "enc-1",
          usuario: { nombre: "Ana" },
        },
      ]),
    };

    const res = await request(app)
      .get("/zonas/encargados") // Ya no enviamos ?rol=...
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("rejects non equipo_padi roles", async () => {
    // Mockeamos como un rol que NO tiene permiso para esta ruta
    mockAuthAs("encargado_zona");

    const res = await request(app)
      .get("/zonas/encargados")
      .set("Authorization", "Bearer fake-token");

    // Ahora el middleware requireRole debería devolver 403 automáticamente
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });
});

