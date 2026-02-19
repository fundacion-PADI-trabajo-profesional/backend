import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as prismaClient from "../src/config/prismaClient";
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

    const fakePrisma = {
      encargados: {
        findUnique: vi.fn().mockResolvedValue({ id: "enc1", zona: "Norte" }),
      },
      escuelas: {
        findUnique: vi.fn().mockResolvedValue({ id: "esc1", zona: "Norte" }),
      },
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({ id: "dir1", rol: "director" }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: any) => cb(txMock)),
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post("/directivos/dir1/asignar-escuela")
      .send({
        escuela_id: "esc1",
        usuario_id: "encargado-user-1",
        rol: "encargado_zona",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(txMock.usuarioPerfil.updateMany).toHaveBeenCalled();
    expect(txMock.usuarioPerfil.update).toHaveBeenCalled();
  });
});

describe("evaluaciones endpoint", () => {
  it("returns empty list", async () => {
    const res = await request(app).get("/evaluaciones");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 404 when not found", async () => {
    const res = await request(app).get("/evaluaciones/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: "Evaluación no encontrada" });
  });
});

describe("zonas encargados endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows equipo_padi to list encargados for zone assignment", async () => {
    const fakePrisma = {
      encargados: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "enc-1",
            zona_id: null,
            usuario: {
              id: "user-1",
              nombre: "Ana",
              apellido: "Lopez",
              email: "ana@test.com",
            },
            zona: null,
          },
        ]),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app).get("/zonas/encargados?rol=equipo_padi");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects non equipo_padi roles", async () => {
    const res = await request(app).get("/zonas/encargados?rol=encargado_zona");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });
});


