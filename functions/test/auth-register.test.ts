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
    const personasCreate = vi.fn().mockResolvedValue({ id: "per-1" });
    const profesoresFindUnique = vi.fn().mockResolvedValue(null);
    const profesoresCreate = vi.fn().mockResolvedValue({ id: "doc-1", persona_id: "per-1" });
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
      // Solo lo que usamos en el servicio
      // @ts-ignore
      personas: { create: personasCreate },
      // @ts-ignore
      profesores: { findUnique: profesoresFindUnique, create: profesoresCreate },
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
    expect(profesoresFindUnique).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(profesoresCreate).toHaveBeenCalledTimes(1);
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

    expect(res.status).toBe(201);
    expect(personasCreate).not.toHaveBeenCalled();
    expect(profesoresCreate).not.toHaveBeenCalled();
  });
});


