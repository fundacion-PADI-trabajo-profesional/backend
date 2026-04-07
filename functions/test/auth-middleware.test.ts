import { describe, it, expect, vi, afterEach } from "vitest";
import { requireAuth, requireRole, AuthenticatedRequest } from "../src/middlewares/auth.middleware";
import * as supabaseClient from "../src/config/supabaseClient";
import * as prismaClient from "../src/config/prismaClient";
import { Response, NextFunction } from "express";

afterEach(() => {
    vi.restoreAllMocks();
});

//HELPERS
function mockRes(): Partial<Response> {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

function mockNext(): NextFunction {
    return vi.fn();
}

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
    return {
        headers: {},
        ...overrides,
    } as AuthenticatedRequest;
}

// ─── TESTS UNITARIOS: requireAuth ─────────────────────
describe("requireAuth middleware", () => {
    it("devuelve 401 si no hay header Authorization", async () => {
        const req = mockReq({ headers: {} });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Token de autenticación requerido." })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("devuelve 401 si el header no empieza con Bearer", async () => {
        const req = mockReq({ headers: { authorization: "Basic abc123" } });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("devuelve 401 si Supabase rechaza el token", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: { message: "jwt expired" },
                }),
            },
        } as any);

        const req = mockReq({ headers: { authorization: "Bearer token-invalido" } });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Token inválido o expirado." })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("devuelve 403 si el usuario Auth existe pero no tiene perfil en BD", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: "user-sin-perfil" } },
                    error: null,
                }),
            },
        } as any);

        vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
            usuarioPerfil: {
                findUnique: vi.fn().mockResolvedValue(null),
            },
        } as any);

        const req = mockReq({ headers: { authorization: "Bearer token-valido" } });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it("adjunta user al request y llama next() cuando el token es válido", async () => {
        const fakeProfile = {
            id: "user-1",
            email: "test@padi.com",
            rol: "equipo_padi",
            nombre: "Admin",
            apellido: "PADI",
            escuela_id: null,
        };

        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: "user-1" } },
                    error: null,
                }),
            },
        } as any);

        vi.spyOn(prismaClient, "getPrisma").mockReturnValue({
            usuarioPerfil: {
                findUnique: vi.fn().mockResolvedValue(fakeProfile),
            },
        } as any);

        const req = mockReq({ headers: { authorization: "Bearer token-valido" } });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toEqual(fakeProfile);
    });

    it("devuelve 500 si Supabase client no está disponible", async () => {
        vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(null);

        const req = mockReq({ headers: { authorization: "Bearer cualquier-token" } });
        const res = mockRes();
        const next = mockNext();

        await requireAuth(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });
});

// ─── TESTS UNITARIOS: requireRole ─────────────────────
describe("requireRole middleware", () => {
    it("llama next() si el usuario tiene un rol permitido", () => {
        const middleware = requireRole("equipo_padi", "encargado_zona");
        const req = mockReq();
        req.user = { id: "u1", email: "a@b.com", rol: "equipo_padi", nombre: "A", apellido: "B" };
        const res = mockRes();
        const next = mockNext();

        middleware(req, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it("devuelve 403 si el usuario no tiene un rol permitido", () => {
        const middleware = requireRole("equipo_padi");
        const req = mockReq();
        req.user = { id: "u2", email: "d@e.com", rol: "docente", nombre: "D", apellido: "E" };
        const res = mockRes();
        const next = mockNext();

        middleware(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it("devuelve 401 si no hay user en el request (middleware requireAuth no corrió)", () => {
        const middleware = requireRole("equipo_padi");
        const req = mockReq();
        // req.user no está definido
        const res = mockRes();
        const next = mockNext();

        middleware(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});