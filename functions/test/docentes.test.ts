import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { DocenteRepository } from "../src/repositories/docente.repository";
import * as prismaClient from "../src/config/prismaClient";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("docentes endpoints", () => {
  it("GET /docentes returns 200 and list of docentes", async () => {
    const mock = [
      {
        id: "u1",
        personas: { nombre: "Ana", primer_apellido: "Pérez" },
        profesores_escuelas: [{ escuela: { id: "esc1", nombre: "Escuela Norte" } }],
        profesores_aulas: [
          {
            aula: {
              id: "a1",
              comision: "Delfines",
              turno: "mañana",
              sala: { grado: 4 },
              escuela: { nombre: "Escuela Norte" },
            },
          },
        ],
      },
      {
        id: "u2",
        personas: { nombre: "Bruno", primer_apellido: "García" },
        profesores_escuelas: [],
        profesores_aulas: [],
      },
    ];
    const spy = vi.spyOn(DocenteRepository, "list").mockResolvedValue(mock as any);
    const res = await request(app).get("/docentes?usuario_id=u-padi&rol=equipo_padi");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toMatchObject({
      id: "u1",
      escuelas: [{ id: "esc1", nombre: "Escuela Norte" }],
      aulas: [
        {
          id: "a1",
          comision: "Delfines",
          turno: "mañana",
          grado: 4,
          escuelaNombre: "Escuela Norte",
        },
      ],
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("GET /docentes for director lists only docentes assigned to their school", async () => {
    const mock = [
      {
        id: "u1",
        personas: { nombre: "Ana", primer_apellido: "Pérez" },
        profesores_escuelas: [{ escuela: { id: "esc-dir", nombre: "Escuela Director" } }],
        profesores_aulas: [],
      },
    ];

    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          rol: "director",
          escuela_id: "esc-dir",
        }),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);
    const spy = vi.spyOn(DocenteRepository, "listByEscuela").mockResolvedValue(mock as any);

    const res = await request(app).get("/docentes?usuario_id=dir-1&rol=director");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(spy).toHaveBeenCalledWith("esc-dir");
  });

  it("POST /docentes/:id/asignar-escuela assigns one school", async () => {
    const fakePrisma = {
      profesores: { findUnique: vi.fn().mockResolvedValue({ id: "doc-1" }) },
      escuelas: { findUnique: vi.fn().mockResolvedValue({ id: "esc-1" }) },
      profesoresEscuelas: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pe-1" }),
      },
    };
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post("/docentes/doc-1/asignar-escuela")
      .send({
        escuela_id: "esc-1",
        usuario_id: "padi-1",
        rol: "equipo_padi",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fakePrisma.profesoresEscuelas.create).toHaveBeenCalled();
  });

  it("POST /docentes/:id/desasignar-escuela closes assignment and aula links", async () => {
    const fakePrisma = {
      $transaction: vi.fn().mockImplementation(async (cb: any) =>
        cb({
          profesoresEscuelas: {
            findFirst: vi.fn().mockResolvedValue({ id: "pe-1" }),
            update: vi.fn().mockResolvedValue({ id: "pe-1" }),
          },
          profesoresAulas: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        }),
      ),
    };
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post("/docentes/doc-1/desasignar-escuela")
      .send({
        escuela_id: "esc-1",
        usuario_id: "enc-1",
        rol: "encargado_zona",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fakePrisma.$transaction).toHaveBeenCalled();
  });
});


