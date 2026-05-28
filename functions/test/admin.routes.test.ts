/**
 * TEST: Admin Routes — Tests de integración HTTP
 *
 * Prueba los endpoints del panel de administración de usuarios a través de supertest.
 * Cubre autenticación, autorización por rol y comportamiento de cada endpoint.
 *
 * Endpoints cubiertos:
 *   GET    /admin/users
 *   POST   /admin/users
 *   POST   /admin/users/bulk
 *   POST   /admin/users/:id/resend-invite
 *   DELETE /admin/users/:id
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { mockAuthAs } from "./helpers/auth-mock";
import * as supabaseClient from "../src/config/supabaseClient";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Usuarios de Auth ficticios para listUsers */
const AUTH_USERS_MOCK = [
  { id: "uid-1", last_sign_in_at: "2024-01-01T00:00:00Z" },
  { id: "uid-2", last_sign_in_at: null },
];

/** Perfiles ficticios de la tabla usuarios */
const PROFILES_MOCK = [
  { id: "uid-1", email: "dir@t.com", nombre: "Carlos", apellido: "Dir", rol: "director" },
  { id: "uid-2", email: "doc@t.com", nombre: "María", apellido: "Doc", rol: "docente" },
];

/**
 * Sobreescribe el mock de Supabase para que simule listUsers de Auth + perfiles.
 * Se usa como extensión del supabaseMock retornado por mockAuthAs.
 */
function patchSupabaseForList(supabaseMock: any) {
  supabaseMock.auth.admin.listUsers = vi.fn().mockResolvedValue({
    data: { users: AUTH_USERS_MOCK },
    error: null,
  });
  supabaseMock.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: PROFILES_MOCK, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
}

// ─── GET /admin/users ─────────────────────────────────────────────────────────

describe("GET /admin/users", () => {
  afterEach(() => vi.restoreAllMocks());

  it("200: equipo_padi puede listar usuarios con campo 'estado'", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    patchSupabaseForList(supabaseMock);

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("estado");
    expect(res.body[0].estado).toBe("activo");
    expect(res.body[1].estado).toBe("pendiente");
  });

  it("403: docente no puede acceder a la lista de usuarios", async () => {
    mockAuthAs("docente", "doc-id");

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  it("403: director no puede acceder a la lista de usuarios", async () => {
    mockAuthAs("director", "dir-id");

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  it("401: sin token no puede acceder", async () => {
    const res = await request(app).get("/admin/users");
    expect(res.status).toBe(401);
  });

  it("500: devuelve error si Auth falla internamente", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.listUsers = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });
});

// ─── POST /admin/users ────────────────────────────────────────────────────────

describe("POST /admin/users", () => {
  const VALID_PAYLOAD = {
    nombre: "Juan",
    apellido: "Pérez",
    email: "juan@padi.com",
    rol: "docente",
  };

  afterEach(() => vi.restoreAllMocks());

  it("201: equipo_padi crea un usuario correctamente", async () => {
    const { supabaseMock, prismaMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: "new-uid" } },
      error: null,
    });
    supabaseMock.from = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    prismaMock.personas = { create: vi.fn().mockResolvedValue({ id: "persona-id" }), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.profesores = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.encargados = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };

    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("creado exitosamente");
    expect(res.body.user).toMatchObject({ id: "new-uid", email: VALID_PAYLOAD.email });
  });

  it("400: falta el campo nombre", async () => {
    mockAuthAs("equipo_padi", "admin-id");
    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send({ apellido: "P", email: "j@t.com", rol: "docente" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("obligatorios");
  });

  it("400: falta el campo email", async () => {
    mockAuthAs("equipo_padi", "admin-id");
    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send({ nombre: "A", apellido: "B", rol: "docente" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("obligatorios");
  });

  it("400: falta el campo rol", async () => {
    mockAuthAs("equipo_padi", "admin-id");
    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send({ nombre: "A", apellido: "B", email: "a@t.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("obligatorios");
  });

  it("400: rol inválido es rechazado", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "bad" },
    });

    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send({ ...VALID_PAYLOAD, rol: "hacker" });

    expect(res.status).toBe(400);
  });

  it("400: email duplicado devuelve mensaje claro", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "User already registered", code: "email_exists" },
    });

    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Ya existe un usuario");
  });

  it("403: docente no puede crear usuarios", async () => {
    mockAuthAs("docente", "doc-id");
    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it("401: sin token no puede crear usuario", async () => {
    const res = await request(app).post("/admin/users").send(VALID_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it("400: email con formato inválido es rechazado", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn();

    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer valid-token")
      .send({ ...VALID_PAYLOAD, email: "no-es-email" });

    expect(res.status).toBe(400);
    expect(supabaseMock.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });
});

// ─── POST /admin/users/bulk ───────────────────────────────────────────────────

describe("POST /admin/users/bulk", () => {
  afterEach(() => vi.restoreAllMocks());

  const VALID_USERS = [
    { nombre: "A", apellido: "A", email: "a@t.com", rol: "docente" },
    { nombre: "B", apellido: "B", email: "b@t.com", rol: "director" },
  ];

  it("200: crea todos los usuarios y devuelve 'creados' y 'errores'", async () => {
    const { supabaseMock, prismaMock } = mockAuthAs("equipo_padi", "admin-id");
    let callCount = 0;
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockImplementation(async () => {
      callCount++;
      return { data: { user: { id: `uid-${callCount}` } }, error: null };
    });
    supabaseMock.from = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    prismaMock.personas = { create: vi.fn().mockResolvedValue({ id: "persona-id" }), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.profesores = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.encargados = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };

    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ users: VALID_USERS });

    expect(res.status).toBe(200);
    expect(res.body.creados).toHaveLength(2);
    expect(res.body.errores).toHaveLength(0);
    expect(res.body.message).toContain("2 usuario(s) creado(s)");
  });

  it("200: resultado parcial cuando algunos fallan", async () => {
    const { supabaseMock, prismaMock } = mockAuthAs("equipo_padi", "admin-id");
    let callCount = 0;
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { data: { user: { id: "uid-1" } }, error: null };
      return { data: null, error: { message: "email_exists", code: "email_exists" } };
    });
    supabaseMock.from = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    prismaMock.personas = { create: vi.fn().mockResolvedValue({ id: "persona-id" }), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.profesores = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };
    prismaMock.encargados = { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) };

    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ users: VALID_USERS });

    expect(res.status).toBe(200);
    expect(res.body.creados).toHaveLength(1);
    expect(res.body.errores).toHaveLength(1);
  });

  it("400: todos los usuarios fallan → status 400", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "email_exists", code: "email_exists" },
    });

    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ users: VALID_USERS });

    expect(res.status).toBe(400);
    expect(res.body.errores).toHaveLength(2);
  });

  it("400: body sin campo 'users'", async () => {
    mockAuthAs("equipo_padi", "admin-id");
    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ data: VALID_USERS });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("array");
  });

  it("400: users es array vacío", async () => {
    mockAuthAs("equipo_padi", "admin-id");
    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ users: [] });

    expect(res.status).toBe(400);
  });

  it("403: director no puede hacer carga masiva", async () => {
    mockAuthAs("director", "dir-id");
    const res = await request(app)
      .post("/admin/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ users: VALID_USERS });

    expect(res.status).toBe(403);
  });
});

// ─── POST /admin/users/:id/resend-invite ─────────────────────────────────────

describe("POST /admin/users/:id/resend-invite", () => {
  afterEach(() => vi.restoreAllMocks());

  it("200: equipo_padi puede reenviar la invitación a un usuario pendiente", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");

    supabaseMock.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { email: "inv@t.com", nombre: "Inv", apellido: "User", rol: "docente" },
        error: null,
      }),
    });
    supabaseMock.auth.admin.getUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "u-pending", last_sign_in_at: null } },
      error: null,
    });
    supabaseMock.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: "u-pending" } },
      error: null,
    });

    const res = await request(app)
      .post("/admin/users/u-pending/resend-invite")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("reenviada");
    expect(supabaseMock.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "inv@t.com",
      expect.any(Object)
    );
  });

  it("400: no se puede reenviar a un usuario ya activo", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");

    supabaseMock.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { email: "active@t.com", nombre: "A", apellido: "U", rol: "docente" },
        error: null,
      }),
    });
    supabaseMock.auth.admin.getUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "u-active", last_sign_in_at: "2024-05-01T00:00:00Z" } },
      error: null,
    });

    const res = await request(app)
      .post("/admin/users/u-active/resend-invite")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("ya activó su cuenta");
  });

  it("400: usuario no encontrado en la tabla usuarios", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");

    supabaseMock.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await request(app)
      .post("/admin/users/u-ghost/resend-invite")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("no encontrado");
  });

  it("403: encargado_zona no puede reenviar invitaciones", async () => {
    mockAuthAs("encargado_zona", "enc-id");

    const res = await request(app)
      .post("/admin/users/u1/resend-invite")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  it("401: sin token no puede acceder", async () => {
    const res = await request(app).post("/admin/users/u1/resend-invite");
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────

describe("DELETE /admin/users/:id", () => {
  afterEach(() => vi.restoreAllMocks());

  it("200: equipo_padi puede eliminar un usuario", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.deleteUser = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await request(app)
      .delete("/admin/users/target-user-id")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("eliminado");
  });

  it("400: un admin no puede eliminarse a sí mismo", async () => {
    mockAuthAs("equipo_padi", "self-id");

    const res = await request(app)
      .delete("/admin/users/self-id") // mismo que el userId del mock
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("propia cuenta");
  });

  it("200: Auth no encuentra al usuario (registro fantasma) → igual elimina de la tabla", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      error: { message: "user not found" },
    });
    supabaseMock.from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await request(app)
      .delete("/admin/users/ghost-id")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("eliminado");
  });

  it("400: Auth falla con error distinto a not-found → responde 400", async () => {
    const { supabaseMock } = mockAuthAs("equipo_padi", "admin-id");
    supabaseMock.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      error: { message: "permission denied" },
    });

    const res = await request(app)
      .delete("/admin/users/bad-id")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("permission denied");
  });

  it("403: docente no puede eliminar usuarios", async () => {
    mockAuthAs("docente", "doc-id");

    const res = await request(app)
      .delete("/admin/users/other-id")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  it("401: sin token no puede eliminar", async () => {
    const res = await request(app).delete("/admin/users/some-id");
    expect(res.status).toBe(401);
  });
});