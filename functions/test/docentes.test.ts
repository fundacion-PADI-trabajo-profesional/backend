import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { DocenteRepository } from "../src/repositories/docente.repository";
import * as prismaClient from "../src/config/prismaClient";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("docentes endpoints", () => {
  it("GET /docentes returns 200 and list of docentes", async () => {
    mockAuthAs("equipo_padi", "u-padi");

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
    ];

    const spy = vi.spyOn(DocenteRepository, "list").mockResolvedValue(mock as any);

    // 2. Quitamos los query params y agregamos el header Authorization
    const res = await request(app)
      .get("/docentes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("GET /docentes for director lists only docentes assigned to their school", async () => {

    const schoolId = "esc-dir";

    // 1. Mockeamos como director y pasamos el schoolId en los overrides
    mockAuthAs("director", "dir-1", { escuela_id: schoolId });

    const mock = [{ id: "u1", personas: { nombre: "Ana", primer_apellido: "Pérez" }, profesores_escuelas: [] }];
    const spy = vi.spyOn(DocenteRepository, "listByEscuela").mockResolvedValue(mock as any);

    // 2. Request limpio con el token
    const res = await request(app)
      .get("/docentes")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    // Verificamos que se llamó al repositorio con el ID de escuela que inyectamos en el mock
    expect(spy).toHaveBeenCalledWith(schoolId);
  });

  it("POST /docentes/:id/asignar-escuela assigns one school", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");

    //Extendemos el mock de Prisma para los modelos específicos que usa este endpoint
    prismaMock.profesores = { findUnique: vi.fn().mockResolvedValue({ id: "doc-1" }) };
    prismaMock.escuelas = { findUnique: vi.fn().mockResolvedValue({ id: "esc-1" }) };
    prismaMock.profesoresEscuelas = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "pe-1" }),
    };

    const res = await request(app)
      .post("/docentes/doc-1/asignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-1" }); // Ya no enviamos usuario_id ni rol en el body

    expect(res.status).toBe(200);
    expect(prismaMock.profesoresEscuelas.create).toHaveBeenCalled();
  });

  it("POST /docentes/:id/desasignar-escuela closes assignment", async () => {
    //Mockeamos la sesión (encargado_zona tiene permiso)
    const { prismaMock } = mockAuthAs("encargado_zona");

    // Mock del transaction
    prismaMock.$transaction = vi.fn().mockImplementation(async (cb: any) =>
      cb({
        profesoresEscuelas: {
          findFirst: vi.fn().mockResolvedValue({ id: "pe-1" }),
          update: vi.fn().mockResolvedValue({ id: "pe-1" }),
        },
        profesoresAulas: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      })
    );

    const res = await request(app)
      .post("/docentes/doc-1/desasignar-escuela")
      .set("Authorization", "Bearer fake-token")
      .send({ escuela_id: "esc-1" });

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});


