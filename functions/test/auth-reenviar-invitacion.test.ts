/**
 * Autoservicio del link de activación.
 *
 * [UNITARIOS] AuthService.reenviarInvitacionPorEmail
 *   ✓ correo sin cuenta → "no_registrada", no llama a inviteUserByEmail
 *   ✓ cuenta ya activa (last_sign_in_at) → "ya_activa", no llama a inviteUserByEmail
 *   ✓ cuenta pendiente → "enviada", invita con redirectTo /cambiar-contrasena-temporal y los datos del perfil
 *   ✓ rate limit de Supabase → mensaje "demasiados intentos"
 *
 * [INTEGRACIÓN] POST /auth/reenviar-invitacion
 *   ✓ 200 con el mismo mensaje para cuenta pendiente, inexistente y ya activa
 *   ✓ 400 sin email, con formato inválido, o con rate limit
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { AuthService } from "../src/services/auth.service";
import { MENSAJE_REENVIO_INVITACION } from "../src/controllers/auth.controller";
import * as supabaseClient from "../src/config/supabaseClient";

const app = createApp();

const PERFIL = { id: "u-1", email: "docente@padi.com", nombre: "Ana", apellido: "Pérez", rol: "docente" };

function mockSupabase(o: { perfil?: any; lastSignIn?: string | null; inviteError?: any } = {}) {
  const invite = vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: o.inviteError ?? null });
  const getUserById = vi.fn().mockResolvedValue({ data: { user: { id: "u-1", last_sign_in_at: o.lastSignIn ?? null } } });
  const maybeSingle = vi.fn().mockResolvedValue({ data: o.perfil === undefined ? PERFIL : o.perfil, error: null });
  const mock = {
    auth: { admin: { inviteUserByEmail: invite, getUserById } },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle }),
  };
  vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(mock as any);
  return { invite, getUserById, maybeSingle };
}

afterEach(() => vi.restoreAllMocks());

describe("AuthService.reenviarInvitacionPorEmail", () => {
  it("correo sin cuenta: no_registrada y no invita", async () => {
    const m = mockSupabase({ perfil: null });
    await expect(AuthService.reenviarInvitacionPorEmail("nadie@padi.com")).resolves.toBe("no_registrada");
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("cuenta ya activa: ya_activa y no invita", async () => {
    const m = mockSupabase({ lastSignIn: "2026-10-01T10:00:00Z" });
    await expect(AuthService.reenviarInvitacionPorEmail(PERFIL.email)).resolves.toBe("ya_activa");
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("cuenta pendiente: reenvía la invitación con el redirect de activación y los datos del perfil", async () => {
    const m = mockSupabase();
    process.env.FRONTEND_URL = "https://padi.example";
    await expect(AuthService.reenviarInvitacionPorEmail(PERFIL.email)).resolves.toBe("enviada");
    expect(m.invite).toHaveBeenCalledWith(PERFIL.email, {
      redirectTo: "https://padi.example/cambiar-contrasena-temporal",
      data: { nombre: "Ana", apellido: "Pérez", rol: "docente" },
    });
    delete process.env.FRONTEND_URL;
  });

  it("rate limit de Supabase: mensaje de demasiados intentos", async () => {
    mockSupabase({ inviteError: { message: "email rate limit exceeded" } });
    await expect(AuthService.reenviarInvitacionPorEmail(PERFIL.email)).rejects.toThrow("demasiados intentos");
  });
});

describe("POST /auth/reenviar-invitacion", () => {
  it("200 con el mismo mensaje: pendiente, inexistente y ya activa", async () => {
    for (const caso of [{}, { perfil: null }, { lastSignIn: "2026-10-01T10:00:00Z" }]) {
      mockSupabase(caso);
      const res = await request(app).post("/auth/reenviar-invitacion").send({ email: "alguien@padi.com" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe(MENSAJE_REENVIO_INVITACION);
      vi.restoreAllMocks();
    }
  });

  it("400 sin email o con formato inválido, sin tocar Supabase", async () => {
    const m = mockSupabase();
    expect((await request(app).post("/auth/reenviar-invitacion").send({})).status).toBe(400);
    const res = await request(app).post("/auth/reenviar-invitacion").send({ email: "no-es-un-mail" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("formato");
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("400 con el mensaje traducido cuando Supabase limita los envíos", async () => {
    mockSupabase({ inviteError: { message: "rate limit exceeded" } });
    const res = await request(app).post("/auth/reenviar-invitacion").send({ email: PERFIL.email });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("demasiados intentos");
  });
});
