import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as supabaseClient from "../src/config/supabaseClient";
import * as prismaClient from "../src/config/prismaClient";
import { mockAuthAs } from "./helpers/auth-mock";

const app = createApp();

function mockPrismaOk(returnValue = { id: "u-1", nombre: "Nuevo", apellido: "Apellido" }) {
    const updateMock = vi.fn().mockResolvedValue(returnValue);
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
        // @ts-ignore
        usuarioPerfil: { update: updateMock },
        // @ts-ignore
        personas: { update: vi.fn().mockResolvedValue({}) },
    } as any);
    return { updateMock };
}

function mockSupabaseResetOk() {
    const resetMock = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
        auth: { resetPasswordForEmail: resetMock },
        // sendPasswordResetEmail ahora verifica si el email existe antes de llamar a Auth
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "u-1" }, error: null }),
        }),
    } as any);
    return { resetMock };
}

function mockSupabaseUpdatePasswordOk() {
    const setSessionMock = vi.fn().mockResolvedValue({ error: null });
    const updateUserMock = vi.fn().mockResolvedValue({ error: null });
    const signOutMock = vi.fn().mockResolvedValue({});
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
        auth: {
            setSession: setSessionMock,
            updateUser: updateUserMock,
            signOut: signOutMock,
        },
    } as any);
    return { setSessionMock, updateUserMock, signOutMock };
}

//PUT /auth/profile

describe("PUT /auth/profile - edición de perfil", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("200 - actualiza nombre y apellido correctamente", async () => {
        // mockAuthAs configura getUser (Supabase) + findUnique (Prisma) para que
        // el middleware requireAuth pase correctamente.
        const { prismaMock } = mockAuthAs("docente", "u-1");
        const updateMock = vi.fn().mockResolvedValue({ id: "u-1", nombre: "Carlos", apellido: "López" });
        prismaMock.usuarioPerfil.update = updateMock;

        const res = await request(app)
            .put("/auth/profile")
            .send({ userId: "u-1", nombre: "Carlos", apellido: "López" })
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message", "Perfil actualizado con éxito");
        expect(res.body).toHaveProperty("profile");
        expect(updateMock).toHaveBeenCalledWith({
            where: { id: "u-1" },
            data: { nombre: "Carlos", apellido: "López" },
        });
    });

    it("400 - body vacío (sin nombre ni apellido)", async () => {
        // El handler toma userId de req.user (JWT), no del body.
        // La única validación pendiente es que nombre y apellido estén presentes.
        mockAuthAs("docente", "u-1");

        const res = await request(app)
            .put("/auth/profile")
            .send({})
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("obligatorio");
    });

    it("400 - falta nombre en el body", async () => {
        mockAuthAs("docente", "u-1");

        const res = await request(app)
            .put("/auth/profile")
            .send({ apellido: "López" })
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("obligatorio");
    });

    it("400 - falta apellido en el body", async () => {
        mockAuthAs("docente", "u-1");

        const res = await request(app)
            .put("/auth/profile")
            .send({ nombre: "Carlos" })
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("obligatorio");
    });

    it("400 - Prisma falla al hacer el update (ej: usuario no existe)", async () => {
        const { prismaMock } = mockAuthAs("docente", "inexistente");
        prismaMock.usuarioPerfil.update = vi.fn().mockRejectedValue(new Error("Record not found"));

        const res = await request(app)
            .put("/auth/profile")
            .send({ userId: "inexistente", nombre: "Carlos", apellido: "López" })
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("message", "No se pudo actualizar el perfil.");
    });

    it("400 - getPrisma devuelve null (DATABASE_URL no configurada)", async () => {
        // requireAuth hace una llamada a getPrisma (para findUnique).
        // El handler hace una segunda llamada. Usamos mockReturnValueOnce para
        // que la primera pase el middleware y la segunda devuelva null al handler.
        const authPrismaMock = {
            usuarioPerfil: {
                findUnique: vi.fn().mockResolvedValue({
                    id: "u-1", rol: "docente", nombre: "X", apellido: "Y",
                }),
            },
        };
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: "u-1" } }, error: null,
                }),
            },
        } as any);
        vi.spyOn(prismaClient, "getPrisma")
            .mockReturnValueOnce(authPrismaMock as any) // requireAuth
            .mockReturnValueOnce(null);                 // handler

        const res = await request(app)
            .put("/auth/profile")
            .send({ userId: "u-1", nombre: "Carlos", apellido: "López" })
            .set("Authorization", "Bearer fake-token")
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("no disponible");
    });
});

//POST /auth/reset-password-request

describe("POST /auth/reset-password-request - solicitud de cambio de contraseña", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("200 - envía el correo de recuperación correctamente", async () => {
        const { resetMock } = mockSupabaseResetOk();

        const res = await request(app)
            .post("/auth/reset-password-request")
            .send({ email: "usuario@ejemplo.com" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message", "Correo de recuperación enviado exitosamente.");
        expect(resetMock).toHaveBeenCalledWith(
            "usuario@ejemplo.com",
            expect.objectContaining({ redirectTo: expect.any(String) })
        );
    });

    it("400 - no se envía email en el body", async () => {
        const res = await request(app)
            .post("/auth/reset-password-request")
            .send({})
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("message", "El correo electrónico es obligatorio.");
    });

    it("400 - Supabase responde con rate limit", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                resetPasswordForEmail: vi.fn().mockResolvedValue({
                    error: { code: "over_email_send_rate_limit" },
                }),
            },
            // El servicio verifica primero si el email existe antes de llamar a Auth
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "u-1" }, error: null }),
            }),
        } as any);

        const res = await request(app)
            .post("/auth/reset-password-request")
            .send({ email: "usuario@ejemplo.com" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Demasiados intentos");
    });

    it("400 - Supabase no está disponible (getSupabase devuelve null)", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);

        const res = await request(app)
            .post("/auth/reset-password-request")
            .send({ email: "usuario@ejemplo.com" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("no está disponible");
    });
});

//POST /auth/update-password

describe("POST /auth/update-password - actualización de contraseña con tokens", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("200 - actualiza la contraseña con tokens válidos", async () => {
        const { setSessionMock, updateUserMock, signOutMock } = mockSupabaseUpdatePasswordOk();

        const res = await request(app)
            .post("/auth/update-password")
            .send({
                accessToken: "acc-tok-valido",
                refreshToken: "ref-tok-valido",
                newPassword: "NuevaPass123",
            })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message", "Contraseña actualizada exitosamente.");
        expect(setSessionMock).toHaveBeenCalledWith({
            access_token: "acc-tok-valido",
            refresh_token: "ref-tok-valido",
        });
        expect(updateUserMock).toHaveBeenCalledWith({ password: "NuevaPass123" });
        expect(signOutMock).toHaveBeenCalled();
    });

    it("400 - falta accessToken", async () => {
        const res = await request(app)
            .post("/auth/update-password")
            .send({ refreshToken: "ref-tok", newPassword: "NuevaPass123" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Faltan datos de seguridad");
    });

    it("400 - falta refreshToken", async () => {
        const res = await request(app)
            .post("/auth/update-password")
            .send({ accessToken: "acc-tok", newPassword: "NuevaPass123" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Faltan datos de seguridad");
    });

    it("400 - falta newPassword", async () => {
        const res = await request(app)
            .post("/auth/update-password")
            .send({ accessToken: "acc-tok", refreshToken: "ref-tok" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Faltan datos de seguridad");
    });

    it("400 - el link de recuperación es inválido o expiró", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                setSession: vi.fn().mockResolvedValue({
                    error: { message: "invalid session" },
                }),
                updateUser: vi.fn(),
                signOut: vi.fn().mockResolvedValue({}),
            },
        } as any);

        const res = await request(app)
            .post("/auth/update-password")
            .send({
                accessToken: "tok-expirado",
                refreshToken: "ref-expirado",
                newPassword: "NuevaPass123",
            })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("inválido o ya expiró");
    });
});