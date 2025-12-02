import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as prismaClient from "../src/config/prismaClient";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aulas endpoints", () => {
  const payloadOk = {
    sala_id: 3,
    comision: "Delfines",
    turno: "mañana",
    usuario_id: "director-1",
    rol: "director",
  };

  it("GET /aulas returns list for director", async () => {
    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      aulas: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a1",
            sala_id: 3,
            escuela_id: "esc1",
            comision: "Delfines",
            turno: "mañana",
            sala: { id: 3, nombre: "Sala 3", grado: 3 },
          },
        ]),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app).get(
      `/aulas?usuario_id=${payloadOk.usuario_id}&rol=${payloadOk.rol}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("POST /aulas creates one (201) for director with escuela", async () => {
    const created = {
      id: "a1",
      sala_id: 3,
      escuela_id: "esc1",
      comision: "Delfines",
      turno: "mañana",
    };

    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      salas: {
        findUnique: vi.fn().mockResolvedValue({ id: 3 }),
      },
      aulas: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post("/aulas")
      .send(payloadOk)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.id).toBe("a1");
    expect(fakePrisma.aulas.create).toHaveBeenCalled();
  });

  it("POST /aulas returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/aulas")
      .send({
        sala_id: 3,
        // falta comision, turno, usuario_id, rol
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("POST /aulas returns 400 when user is not director", async () => {
    const res = await request(app)
      .post("/aulas")
      .send({
        ...payloadOk,
        rol: "docente",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "CREATE_ERROR" },
    });
  });
});


