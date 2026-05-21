import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as supabaseClient from "../src/config/supabaseClient";
import * as prismaClient from "../src/config/prismaClient";

const app = createApp();

describe("auth register flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSupabaseSuccess(userId = "u-docente-1") {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: userId, email: "d@ex.com" } },
          error: null,
        }),
        admin: { deleteUser: vi.fn().mockResolvedValue({}) },
      },
      from: () => ({ insert: insertMock }),
    } as any);
    return { insertMock };
  }

  it("POST /auth/register crea persona y profesor cuando rol=docente", async () => {
    mockSupabaseSuccess("doc-1");

    // Mocks de Prisma según la implementación actual de AuthService.register
    const personasCreate = vi.fn().mockResolvedValue({ id: "per-1" });
    const profesoresCreate = vi.fn().mockResolvedValue({ id: "doc-1", persona_id: "per-1" });

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
      // Solo los métodos que usa el servicio para rol=docente
      // @ts-ignore
      personas: { create: personasCreate },
      // @ts-ignore
      profesores: { create: profesoresCreate },
    } as any);

    const res = await request(app)
      .post("/auth/register")
      .send({
        email: "doc@ex.com",
        password: "secret123",
        nombre: "Doc",
        apellido: "ENTE",
        rol: "docente",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(personasCreate).toHaveBeenCalledTimes(1);
    expect(profesoresCreate).toHaveBeenCalledTimes(1);
  });

  it("POST /auth/register rechaza rol=equipo_padi con 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        email: "padi@ex.com",
        password: "secret123",
        nombre: "Padi",
        apellido: "User",
        rol: "equipo_padi",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Rol no permitido");
  });

  it("POST /auth/register rechaza rol=encargado_zona con 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        email: "enc@ex.com",
        password: "secret123",
        nombre: "Enc",
        apellido: "Zona",
        rol: "encargado_zona",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Rol no permitido");
  });

  it("POST /auth/register no toca profesores/personas cuando rol!=docente", async () => {
    mockSupabaseSuccess("dir-1");
    const personasCreate = vi.fn();
    const profesoresCreate = vi.fn();
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
      // @ts-ignore
      personas: { create: personasCreate },
      // @ts-ignore
      profesores: { create: profesoresCreate },
    } as any);

    const res = await request(app)
      .post("/auth/register")
      .send({
        email: "director@ex.com",
        password: "secret123",
        nombre: "Dire",
        apellido: "CTOR",
        rol: "director",
      })
      .set("Content-Type", "application/json");

    // NC1: director ya no puede auto-registrarse
    expect(res.status).toBe(400);
    expect(personasCreate).not.toHaveBeenCalled();
    expect(profesoresCreate).not.toHaveBeenCalled();
  });

  // NC1 — regresión: director rechazado en auto-registro público
  it("POST /auth/register con rol=director devuelve 400 (NC1)", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        email: "director2@ex.com",
        password: "secret123",
        nombre: "Dir",
        apellido: "Ector",
        rol: "director",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Rol no permitido");
  });
});


