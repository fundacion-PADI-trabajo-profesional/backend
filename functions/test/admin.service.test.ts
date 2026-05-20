/**
 * TEST: AdminService — Tests unitarios
 *
 * Cubre todos los métodos del servicio de administración de usuarios:
 *   - createUser
 *   - createUsersBulk
 *   - listUsers
 *   - resendInvite
 *   - deleteUser
 *
 * Las dependencias externas (Supabase) son mockeadas con vi.spyOn.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AdminService, type CreateUserData } from "../src/services/admin.service";
import * as supabaseClient from "../src/config/supabaseClient";
import * as prismaClient from "../src/config/prismaClient"

/** Mock de Prisma que cubre create y deleteMany para todos los modelos usados por AdminService */
function buildPrismaMock() {
  return {
    profesores: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "new-uid" }),
    },
    personas: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "persona-id" }),
    },
    encargados: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye un mock mínimo de Supabase que cubre todos los métodos usados por AdminService */
function buildSupabaseMock(overrides: Record<string, any> = {}) {
  return {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn().mockResolvedValue({
          data: { user: { id: "new-user-id" } },
          error: null,
        }),
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] },
          error: null,
        }),
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "u1", last_sign_in_at: null } },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    // from() devuelve un builder fluent; cada test puede sobreescribir lo que necesite
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    ...overrides,
  };
}

const VALID_USER: CreateUserData = {
  nombre: "Ana",
  apellido: "Gómez",
  email: "ana@padi.com",
  rol: "docente",
};

// ─── createUser ───────────────────────────────────────────────────────────────

describe("AdminService.createUser", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: crea usuario en Auth y perfil, devuelve {id, email}", async () => {
    const mock = buildSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(buildPrismaMock() as any);

    const result = await AdminService.createUser(VALID_USER);

    expect(mock.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      VALID_USER.email,
      expect.objectContaining({ redirectTo: expect.stringContaining("cambiar-contrasena-temporal") })
    );
    expect(mock.from).toHaveBeenCalledWith("usuarios");
    expect(result).toEqual({ id: "new-user-id", email: VALID_USER.email });
  });

  it("pasa el metadata (nombre, apellido, rol) al invite", async () => {
    const mock = buildSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(buildPrismaMock() as any);

    await AdminService.createUser(VALID_USER);

    const [, options] = mock.auth.admin.inviteUserByEmail.mock.calls[0];
    expect(options.data).toMatchObject({
      nombre: "Ana",
      apellido: "Gómez",
      rol: "docente",
    });
  });

  it("lanza error si Supabase client no está disponible", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);
    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow(
      "Supabase client no disponible"
    );
  });

  it("lanza error si el email ya está registrado (email_exists)", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "User already registered", code: "email_exists" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow(
      "Ya existe un usuario con ese correo electrónico."
    );
  });

  it("lanza error si el mensaje de error menciona 'already registered'", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "User with this email is already registered" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow(
      "Ya existe un usuario con ese correo electrónico."
    );
  });

  it("lanza error genérico de Auth si el fallo no es de email duplicado", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "rate limit exceeded" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow(
      "Error al invitar al usuario: rate limit exceeded"
    );
  });

  it("hace rollback (deleteUser) si la inserción de perfil falla", async () => {
    const mock = buildSupabaseMock();
    mock.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: "DB error", code: "99999" } }),
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow("Error al guardar el perfil");
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith("new-user-id");
  });

  it("hace rollback con mensaje de duplicado si profileError.code es 23505", async () => {
    const mock = buildSupabaseMock();
    mock.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: "dup", code: "23505" } }),
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.createUser(VALID_USER)).rejects.toThrow(
      "Ya existe un perfil con ese correo electrónico."
    );
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith("new-user-id");
  });

  it("lanza error si nombre está vacío", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(AdminService.createUser({ ...VALID_USER, nombre: "  " })).rejects.toThrow(
      "El nombre es obligatorio."
    );
  });

  it("lanza error si apellido está vacío", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(AdminService.createUser({ ...VALID_USER, apellido: "" })).rejects.toThrow(
      "El apellido es obligatorio."
    );
  });

  it("lanza error si email está vacío", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(AdminService.createUser({ ...VALID_USER, email: "" })).rejects.toThrow(
      "El email es obligatorio."
    );
  });

  it("lanza error si el formato del email no es válido", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(
      AdminService.createUser({ ...VALID_USER, email: "no-es-un-email" })
    ).rejects.toThrow("El formato del email no es válido.");
  });

  it("lanza error si el rol no es válido", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(
      AdminService.createUser({ ...VALID_USER, rol: "super_admin" as any })
    ).rejects.toThrow("Rol inválido");
  });

  it("acepta todos los roles válidos", async () => {
    const roles = ["equipo_padi", "director", "encargado_zona", "docente"] as const;
    for (const rol of roles) {
      const mock = buildSupabaseMock();
      vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);
      vi.spyOn(prismaClient, "getPrisma").mockReturnValue(buildPrismaMock() as any);
      await expect(AdminService.createUser({ ...VALID_USER, rol })).resolves.not.toThrow();
      vi.restoreAllMocks();
    }
  });
});

// ─── createUsersBulk ──────────────────────────────────────────────────────────

describe("AdminService.createUsersBulk", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: crea todos los usuarios y los devuelve en 'creados'", async () => {
    const mock = buildSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(buildPrismaMock() as any);

    const users: CreateUserData[] = [
      { nombre: "Ana", apellido: "G", email: "ana@t.com", rol: "docente" },
      { nombre: "Luis", apellido: "R", email: "luis@t.com", rol: "director" },
    ];

    const result = await AdminService.createUsersBulk(users);

    expect(result.creados).toHaveLength(2);
    expect(result.errores).toHaveLength(0);
    expect(result.creados[0].email).toBe("ana@t.com");
    expect(result.creados[1].email).toBe("luis@t.com");
  });

  it("reporte mixto: usuarios creados y con errores, no interrumpe el proceso", async () => {
    let callCount = 0;
    const mock = buildSupabaseMock();
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(buildPrismaMock() as any);
    mock.auth.admin.inviteUserByEmail.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        return { data: null, error: { message: "email duplicado", code: "email_exists" } };
      }
      return { data: { user: { id: `uid-${callCount}` } }, error: null };
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const users: CreateUserData[] = [
      { nombre: "A", apellido: "A", email: "a@t.com", rol: "docente" },
      { nombre: "B", apellido: "B", email: "b@t.com", rol: "docente" }, // fallará
      { nombre: "C", apellido: "C", email: "c@t.com", rol: "docente" },
    ];

    const result = await AdminService.createUsersBulk(users);

    expect(result.creados).toHaveLength(2);
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].email).toBe("b@t.com");
    expect(result.errores[0].error).toContain("Ya existe un usuario");
  });

  it("lanza error si el array está vacío", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    await expect(AdminService.createUsersBulk([])).rejects.toThrow(
      "La lista de usuarios no puede estar vacía."
    );
  });

  it("lanza error si el array supera 200 usuarios", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(buildSupabaseMock() as any);
    const tooMany: CreateUserData[] = Array.from({ length: 201 }, (_, i) => ({
      nombre: "U",
      apellido: "U",
      email: `u${i}@test.com`,
      rol: "docente" as const,
    }));
    await expect(AdminService.createUsersBulk(tooMany)).rejects.toThrow(
      "No se pueden crear más de 200 usuarios a la vez."
    );
  });

  it("registra el email '(sin email)' si el usuario no tiene email definido", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "bad request" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const users: CreateUserData[] = [{ nombre: "X", apellido: "X", email: "" as any, rol: "docente" }];
    const result = await AdminService.createUsersBulk(users);

    expect(result.errores[0].email).toBe("(sin email)");
  });
});

// ─── listUsers ────────────────────────────────────────────────────────────────

describe("AdminService.listUsers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: mezcla activo/pendiente según last_sign_in_at", async () => {
    const mock = buildSupabaseMock();

    mock.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", last_sign_in_at: "2024-01-01T00:00:00Z" },
          { id: "u2", last_sign_in_at: null },
        ],
      },
      error: null,
    });

    mock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: "u1", email: "a@t.com", nombre: "A", apellido: "A", rol: "docente" },
          { id: "u2", email: "b@t.com", nombre: "B", apellido: "B", rol: "director" },
        ],
        error: null,
      }),
    });

    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const result = await AdminService.listUsers();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "u1", estado: "activo" });
    expect(result[1]).toMatchObject({ id: "u2", estado: "pendiente" });
  });

  it("usuario sin entrada en Auth queda como pendiente", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "u-sin-auth", email: "x@t.com", nombre: "X", apellido: "X", rol: "docente" }],
        error: null,
      }),
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const result = await AdminService.listUsers();

    expect(result[0].estado).toBe("pendiente");
  });

  it("devuelve array vacío si no hay perfiles", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const result = await AdminService.listUsers();

    expect(result).toEqual([]);
  });

  it("lanza error si auth.admin.listUsers falla", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.listUsers.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.listUsers()).rejects.toThrow(
      "Error al listar usuarios de Auth: permission denied"
    );
  });

  it("lanza error si la query de perfiles falla", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "tabla no existe" } }),
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.listUsers()).rejects.toThrow(
      "Error al obtener perfiles: tabla no existe"
    );
  });

  it("lanza error si Supabase no está disponible", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);
    await expect(AdminService.listUsers()).rejects.toThrow("Supabase client no disponible");
  });
});

// ─── resendInvite ─────────────────────────────────────────────────────────────

describe("AdminService.resendInvite", () => {
  afterEach(() => vi.restoreAllMocks());

  function buildResendMock({
    profileData = { email: "inv@t.com", nombre: "A", apellido: "B", rol: "docente" },
    profileError = null,
    authUser = { id: "u1", last_sign_in_at: null },
    authError = null,
    inviteError = null,
  }: {
    profileData?: any;
    profileError?: any;
    authUser?: any;
    authError?: any;
    inviteError?: any;
  } = {}) {
    const mock = buildSupabaseMock();

    mock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileData, error: profileError }),
    });

    mock.auth.admin.getUserById.mockResolvedValue({
      data: { user: authUser },
      error: authError,
    });

    mock.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: inviteError,
    });

    return mock;
  }

  it("caso feliz: reenvía la invitación sin errores", async () => {
    const mock = buildResendMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).resolves.toBeUndefined();
    expect(mock.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "inv@t.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("cambiar-contrasena-temporal") })
    );
  });

  it("lanza error si el perfil no existe en la tabla usuarios", async () => {
    const mock = buildResendMock({ profileData: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u-ghost")).rejects.toThrow("Usuario no encontrado.");
  });

  it("lanza error si hay error al buscar el perfil", async () => {
    const mock = buildResendMock({ profileError: { message: "fallo DB" } });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).rejects.toThrow("Usuario no encontrado.");
  });

  it("lanza error si el usuario de Auth no se encuentra", async () => {
    const mock = buildResendMock({ authUser: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).rejects.toThrow(
      "Usuario de Auth no encontrado."
    );
  });

  it("lanza error si Auth devuelve error en getUserById", async () => {
    const mock = buildResendMock({ authError: { message: "not found" } });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).rejects.toThrow(
      "Usuario de Auth no encontrado."
    );
  });

  it("lanza error si el usuario ya activó su cuenta (last_sign_in_at definido)", async () => {
    const mock = buildResendMock({
      authUser: { id: "u1", last_sign_in_at: "2024-06-01T00:00:00Z" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).rejects.toThrow(
      "El usuario ya activó su cuenta. No es necesario reenviar la invitación."
    );
  });

  it("lanza error si inviteUserByEmail falla", async () => {
    const mock = buildResendMock({ inviteError: { message: "smtp timeout" } });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.resendInvite("u1")).rejects.toThrow(
      "Error al reenviar invitación: smtp timeout"
    );
  });

  it("lanza error si Supabase no está disponible", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);
    await expect(AdminService.resendInvite("u1")).rejects.toThrow(
      "Supabase client no disponible"
    );
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe("AdminService.deleteUser", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: llama deleteUser en Auth y borra el perfil", async () => {
    const mock = buildSupabaseMock();
    const deleteMock = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mock.from.mockReturnValue({ delete: vi.fn().mockReturnValue(deleteMock) });
    
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.deleteUser("u-to-delete")).resolves.toBeUndefined();
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith("u-to-delete");
    expect(mock.from).toHaveBeenCalledWith("usuarios");
  });

  it("lanza error si Auth.admin.deleteUser falla", async () => {
    const mock = buildSupabaseMock();
    mock.auth.admin.deleteUser.mockResolvedValue({
      error: { message: "user not found" },
    });
    
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AdminService.deleteUser("u-bad")).rejects.toThrow(
      "Error al revocar acceso de autenticación: user not found" 
    );
  });

  it("lanza error si el cliente de Supabase no está disponible", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);
    
    await expect(AdminService.deleteUser("u1")).rejects.toThrow(
      "Cliente de Supabase no disponible." 
    );
  });
});