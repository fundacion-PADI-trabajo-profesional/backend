import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as supabaseClient from "../src/config/supabaseClient";
import * as prismaClient from "../src/config/prismaClient";
import { HealthService } from "../src/services/health.service";

const app = createApp();

afterEach(() => {
    vi.restoreAllMocks();
});

// Helper: mockea Supabase y Prisma para simular un usuario autenticado
function mockAuthenticatedUser(
    userId = "user-1",
    rol = "equipo_padi",
    extra: Record<string, any> = {}
) {
    // Mock de Supabase para getUser (middleware) y cualquier otro uso
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            }),
        },
        // Mock genérico de .from() por si algún servicio lo usa
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        }),
    } as any);

    // Mock de Prisma: el middleware busca el perfil, y los servicios usan otros modelos
    vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
        usuarioPerfil: {
            findUnique: vi.fn().mockResolvedValue({
                id: userId,
                email: "test@padi.com",
                rol,
                nombre: "Test",
                apellido: "User",
                escuela_id: null,
                ...extra,
            }),
        },
        // Agregar otros modelos según necesite cada test
        ...extra.prismaModels,
    } as any);
}

describe("integración: rutas públicas NO requieren token", () => {
    it("GET /health responde sin token", async () => {
        vi.spyOn(HealthService.prototype, "getHealth").mockResolvedValue(undefined as any);
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
    });

    it("POST /auth/login responde sin token", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                signInWithPassword: vi.fn().mockResolvedValue({
                    data: {
                        user: { id: "u1", email: "a@b.com" },
                        session: { access_token: "t" },
                    },
                    error: null,
                }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: "u1", rol: "docente", nombre: "A", apellido: "B" },
                            error: null,
                        }),
                    }),
                }),
            }),
        } as any);

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "a@b.com", password: "pw" });

        expect(res.status).toBe(200);
    });
});

describe("integración: rutas protegidas REQUIEREN token", () => {
    it("GET /docentes devuelve 401 sin token", async () => {
        const res = await request(app).get("/docentes");
        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Token de autenticación requerido.");
    });

    it("GET /escuelas devuelve 401 sin token", async () => {
        const res = await request(app).get("/escuelas");
        expect(res.status).toBe(401);
    });

    it("GET /evaluaciones devuelve 401 sin token", async () => {
        const res = await request(app).get("/evaluaciones");
        expect(res.status).toBe(401);
    });

    it("GET /estudiantes devuelve 401 sin token", async () => {
        const res = await request(app).get("/estudiantes");
        expect(res.status).toBe(401);
    });

    it("GET /zonas devuelve 401 sin token", async () => {
        const res = await request(app).get("/zonas");
        expect(res.status).toBe(401);
    });

    it("GET /aulas devuelve 401 sin token", async () => {
        const res = await request(app).get("/aulas");
        expect(res.status).toBe(401);
    });

    it("GET /docentes devuelve 401 con token inválido", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: { message: "invalid token" },
                }),
            },
        } as any);

        const res = await request(app)
            .get("/docentes")
            .set("Authorization", "Bearer token-invalido");

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Token inválido o expirado.");
    });
});