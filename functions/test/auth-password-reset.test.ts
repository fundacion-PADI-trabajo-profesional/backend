/**
 * TEST: Flujo de recuperación y cambio de contraseña
 *
 * Cubre en dos capas:
 *
 * [UNITARIOS] AuthService
 *   - sendPasswordResetEmail
 *   - updatePassword
 *
 * [INTEGRACIÓN] HTTP via Supertest
 *   - POST /auth/reset-password-request
 *   - POST /auth/update-password
 *
 * Casos cubiertos por método:
 *
 * sendPasswordResetEmail
 *   ✓ caso feliz: email registrado → llama a resetPasswordForEmail y retorna mensaje
 *   ✓ email no registrado en la tabla usuarios → lanza EMAIL_NOT_REGISTERED
 *   ✓ supabase no disponible → lanza error de cliente
 *   ✓ usa FRONTEND_URL del entorno en el redirectTo
 *   ✓ usa fallback localhost:5173 cuando FRONTEND_URL no está definido
 *   ✓ Supabase devuelve error de rate limit → lanza mensaje traducido
 *   ✓ Supabase devuelve error de validación → lanza mensaje traducido
 *
 * updatePassword
 *   ✓ caso feliz: tokens válidos → setSession + updateUser + signOut → retorna mensaje
 *   ✓ setSession falla (token expirado) → lanza "inválido o ya expiró"
 *   ✓ updateUser falla (contraseña débil) → lanza mensaje traducido
 *   ✓ supabase no disponible → lanza error de cliente
 *   ✓ signOut se llama siempre (incluso si updateUser falla)
 *
 * POST /auth/reset-password-request
 *   ✓ 200: email registrado → envía correo
 *   ✓ 400: email no registrado → EMAIL_NOT_REGISTERED
 *   ✓ 400: body sin email → error de validación
 *   ✓ 400: email con formato inválido propagado del servicio
 *   ✓ 400: rate limit de Supabase
 *   ✓ 400: supabase no disponible
 *
 * POST /auth/update-password
 *   ✓ 200: tokens válidos + contraseña nueva → actualiza y retorna mensaje
 *   ✓ 400: body incompleto (falta accessToken)
 *   ✓ 400: body incompleto (falta refreshToken)
 *   ✓ 400: body incompleto (falta newPassword)
 *   ✓ 400: tokens expirados o inválidos
 *   ✓ 400: contraseña nueva muy corta (weak_password)
 *   ✓ 400: supabase no disponible
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { AuthService } from "../src/services/auth.service";
import * as supabaseClient from "../src/config/supabaseClient";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mock base de Supabase que cubre los métodos usados en el flujo de password reset */
function buildResetSupabaseMock(overrides: {
  maybeSingleData?: any;
  resetPasswordError?: any;
  setSessionError?: any;
  updateUserError?: any;
} = {}) {
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const resetPasswordMock = vi.fn().mockResolvedValue({
    error: overrides.resetPasswordError ?? null,
  });
  const setSessionMock = vi.fn().mockResolvedValue({
    error: overrides.setSessionError ?? null,
  });
  const updateUserMock = vi.fn().mockResolvedValue({
    error: overrides.updateUserError ?? null,
  });
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: overrides.maybeSingleData !== undefined ? overrides.maybeSingleData : { id: "u-1" },
    error: null,
  });

  const mock = {
    auth: {
      resetPasswordForEmail: resetPasswordMock,
      setSession: setSessionMock,
      updateUser: updateUserMock,
      signOut: signOutMock,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleMock,
    }),
    // exponer las funciones para assertions
    _mocks: { resetPasswordMock, setSessionMock, updateUserMock, signOutMock, maybeSingleMock },
  };
  return mock;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNITARIOS — AuthService.sendPasswordResetEmail
// ═══════════════════════════════════════════════════════════════════════════════

describe("AuthService.sendPasswordResetEmail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: llama a resetPasswordForEmail con el email y redirectTo correcto", async () => {
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const result = await AuthService.sendPasswordResetEmail("docente@padi.com");

    expect(mock._mocks.maybeSingleMock).toHaveBeenCalled();
    expect(mock._mocks.resetPasswordMock).toHaveBeenCalledWith(
      "docente@padi.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/actualizar-password") })
    );
    expect(result).toEqual({ message: "Correo de recuperación enviado exitosamente." });
  });

  it("usa FRONTEND_URL del entorno en el redirectTo", async () => {
    process.env.FRONTEND_URL = "https://padi.example.com";
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await AuthService.sendPasswordResetEmail("x@padi.com");

    expect(mock._mocks.resetPasswordMock).toHaveBeenCalledWith(
      "x@padi.com",
      { redirectTo: "https://padi.example.com/actualizar-password" }
    );
    delete process.env.FRONTEND_URL;
  });

  it("usa fallback http://localhost:5173 cuando FRONTEND_URL no está definido", async () => {
    delete process.env.FRONTEND_URL;
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await AuthService.sendPasswordResetEmail("x@padi.com");

    expect(mock._mocks.resetPasswordMock).toHaveBeenCalledWith(
      "x@padi.com",
      { redirectTo: "http://localhost:5173/actualizar-password" }
    );
  });

  it("email no registrado en tabla usuarios → lanza EMAIL_NOT_REGISTERED", async () => {
    const mock = buildResetSupabaseMock({ maybeSingleData: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.sendPasswordResetEmail("noexiste@mail.com"))
      .rejects.toThrow("EMAIL_NOT_REGISTERED");

    // No debe haber llegado a llamar a Supabase Auth
    expect(mock._mocks.resetPasswordMock).not.toHaveBeenCalled();
  });

  it("Supabase no disponible → lanza error de cliente", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null as any);

    await expect(AuthService.sendPasswordResetEmail("x@padi.com"))
      .rejects.toThrow("Supabase client no está disponible.");
  });

  it("Supabase devuelve error over_email_send_rate_limit → mensaje en español", async () => {
    const mock = buildResetSupabaseMock({
      resetPasswordError: { code: "over_email_send_rate_limit", message: "rate limit" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.sendPasswordResetEmail("x@padi.com"))
      .rejects.toThrow("Demasiados intentos. Por favor, esperá un momento y volvé a intentar.");
  });

  it("Supabase devuelve error validation_failed → mensaje en español", async () => {
    const mock = buildResetSupabaseMock({
      resetPasswordError: { code: "validation_failed", message: "bad email" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.sendPasswordResetEmail("no-es-email"))
      .rejects.toThrow("Los datos ingresados no son válidos. Revisá el formato del correo.");
  });

  it("Supabase devuelve error desconocido → mensaje con código", async () => {
    const mock = buildResetSupabaseMock({
      resetPasswordError: { code: "some_unknown_code", message: "unknown" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.sendPasswordResetEmail("x@padi.com"))
      .rejects.toThrow("Ocurrió un error de autenticación (Código: some_unknown_code).");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UNITARIOS — AuthService.updatePassword
// ═══════════════════════════════════════════════════════════════════════════════

describe("AuthService.updatePassword", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caso feliz: setSession + updateUser + signOut, retorna mensaje de éxito", async () => {
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const result = await AuthService.updatePassword("access-tok", "refresh-tok", "nueva123");

    expect(mock._mocks.setSessionMock).toHaveBeenCalledWith({
      access_token: "access-tok",
      refresh_token: "refresh-tok",
    });
    expect(mock._mocks.updateUserMock).toHaveBeenCalledWith({ password: "nueva123" });
    expect(mock._mocks.signOutMock).toHaveBeenCalled();
    expect(result).toEqual({ message: "Contraseña actualizada exitosamente." });
  });

  it("setSession falla (token expirado) → lanza 'inválido o ya expiró'", async () => {
    const mock = buildResetSupabaseMock({
      setSessionError: { message: "session expired" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.updatePassword("bad-tok", "bad-ref", "pass123"))
      .rejects.toThrow("El link de recuperación es inválido o ya expiró.");

    // No debe llegar a updateUser si la sesión no se pudo establecer
    expect(mock._mocks.updateUserMock).not.toHaveBeenCalled();
  });

  it("updateUser falla con weak_password → lanza mensaje traducido", async () => {
    const mock = buildResetSupabaseMock({
      updateUserError: { code: "weak_password", message: "too short" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.updatePassword("acc", "ref", "123"))
      .rejects.toThrow("La contraseña es muy débil. Debe tener al menos 6 caracteres.");
  });

  it("updateUser falla con error desconocido → mensaje con código", async () => {
    const mock = buildResetSupabaseMock({
      updateUserError: { code: "some_error", message: "fail" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.updatePassword("acc", "ref", "pass123"))
      .rejects.toThrow("Ocurrió un error de autenticación (Código: some_error).");
  });

  it("signOut se llama siempre, incluso cuando updateUser falla", async () => {
    const mock = buildResetSupabaseMock({
      updateUserError: { code: "weak_password", message: "too short" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await expect(AuthService.updatePassword("acc", "ref", "123")).rejects.toThrow();

    expect(mock._mocks.signOutMock).toHaveBeenCalled();
  });

  it("Supabase no disponible → lanza error de cliente", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null as any);

    await expect(AuthService.updatePassword("acc", "ref", "pass123"))
      .rejects.toThrow("Supabase client no está disponible.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRACIÓN — POST /auth/reset-password-request
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /auth/reset-password-request", () => {
  afterEach(() => vi.restoreAllMocks());

  it("200: email registrado → responde con mensaje de éxito", async () => {
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "docente@padi.com" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("recuperación");
  });

  it("400: email no registrado → body con EMAIL_NOT_REGISTERED", async () => {
    const mock = buildResetSupabaseMock({ maybeSingleData: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "fantasma@padi.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("EMAIL_NOT_REGISTERED");
  });

  it("400: body vacío (sin email) → error de validación del controller", async () => {
    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("correo electrónico es obligatorio");
  });

  it("400: email presente pero vacío → error de validación del controller", async () => {
    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("correo electrónico es obligatorio");
  });

  it("400: rate limit de Supabase → mensaje traducido al español", async () => {
    const mock = buildResetSupabaseMock({
      resetPasswordError: { code: "over_email_send_rate_limit", message: "rate limit" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "docente@padi.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Demasiados intentos");
  });

  it("400: error de validación de Supabase → mensaje traducido", async () => {
    const mock = buildResetSupabaseMock({
      resetPasswordError: { code: "validation_failed", message: "bad" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "no-es-email" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("datos ingresados no son válidos");
  });

  it("400: supabase client no disponible → error genérico de cliente", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null as any);

    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({ email: "docente@padi.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("no está disponible");
  });

  it("responde JSON en todos los casos de error", async () => {
    const res = await request(app)
      .post("/auth/reset-password-request")
      .send({});

    expect(res.type).toMatch(/json/);
    expect(res.body).toHaveProperty("message");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRACIÓN — POST /auth/update-password
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /auth/update-password", () => {
  afterEach(() => vi.restoreAllMocks());

  const VALID_BODY = {
    accessToken: "valid-access-token",
    refreshToken: "valid-refresh-token",
    newPassword: "nuevaContrasena123",
  };

  it("200: tokens válidos y nueva contraseña → actualiza y retorna mensaje", async () => {
    const mock = buildResetSupabaseMock();
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/update-password")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("actualizada exitosamente");
  });

  it("400: falta accessToken en el body", async () => {
    const res = await request(app)
      .post("/auth/update-password")
      .send({ refreshToken: "r", newPassword: "pass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Faltan datos");
  });

  it("400: falta refreshToken en el body", async () => {
    const res = await request(app)
      .post("/auth/update-password")
      .send({ accessToken: "a", newPassword: "pass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Faltan datos");
  });

  it("400: falta newPassword en el body", async () => {
    const res = await request(app)
      .post("/auth/update-password")
      .send({ accessToken: "a", refreshToken: "r" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Faltan datos");
  });

  it("400: body completamente vacío", async () => {
    const res = await request(app)
      .post("/auth/update-password")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Faltan datos");
  });

  it("400: tokens expirados o inválidos → setSession falla", async () => {
    const mock = buildResetSupabaseMock({
      setSessionError: { message: "session expired" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/update-password")
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("inválido o ya expiró");
  });

  it("400: contraseña nueva muy débil → error weak_password", async () => {
    const mock = buildResetSupabaseMock({
      updateUserError: { code: "weak_password", message: "too short" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    const res = await request(app)
      .post("/auth/update-password")
      .send({ ...VALID_BODY, newPassword: "123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("contraseña es muy débil");
  });

  it("400: supabase client no disponible", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null as any);

    const res = await request(app)
      .post("/auth/update-password")
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("no está disponible");
  });

  it("responde JSON en todos los casos de error", async () => {
    const res = await request(app)
      .post("/auth/update-password")
      .send({});

    expect(res.type).toMatch(/json/);
    expect(res.body).toHaveProperty("message");
  });

  it("signOut se invoca incluso cuando updateUser falla (no leakea sesión)", async () => {
    const mock = buildResetSupabaseMock({
      updateUserError: { code: "weak_password", message: "too short" },
    });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);

    await request(app)
      .post("/auth/update-password")
      .send({ ...VALID_BODY, newPassword: "123" });

    expect(mock._mocks.signOutMock).toHaveBeenCalled();
  });
});
