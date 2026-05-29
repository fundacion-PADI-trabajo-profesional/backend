import { vi } from "vitest";
import * as supabaseClient from "../../src/config/supabaseClient";
import * as prismaClient from "../../src/config/prismaClient";

/**
 * Mockea la cadena completa de autenticación (Supabase getUser + Prisma findUnique).
 * se llama en cada test para simular un usuario logueado.
 *
 * Devuelve los mocks para que se pueda agregar más modelos de Prisma si el test lo necesita.
 */
export function mockAuthAs(
    rol: string,
    userId = "test-user-id",
    overrides: Record<string, any> = {}
) {
    const supabaseMock = {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            }),
            // Agregar otros métodos si se necesitan
            signUp: vi.fn().mockResolvedValue({
                data: { user: { id: userId, email: "mock@test.com" } },
                error: null,
            }),
            admin: { deleteUser: vi.fn().mockResolvedValue({}) },
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            delete: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
            }),
        }),
    };

    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue(supabaseMock as any);

    const prismaMock: any = {
        usuarioPerfil: {
            findUnique: vi.fn().mockResolvedValue({
                id: userId,
                rol,
                escuela_id: null,
                ...overrides,
            }),
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },

        profesoresAulas: {},
        estudiantes: {},
        aulas: {
            findUnique: vi.fn().mockResolvedValue({ escuela_id: null }),
        },
        encargados: {},
    };

    // Mockeamos withRLSContext y withRLSContextAsAdmin para que llamen fn(prismaMock)
    // directamente, evitando la cadena real de $transaction + $executeRaw.
    // Los tests que necesiten comportamiento específico (ej: rechazar la transacción)
    // pueden sobreescribir estas spies con vi.spyOn() en su propio test.
    vi.spyOn(prismaClient, "withRLSContext").mockImplementation((fn: any) => fn(prismaMock));
    vi.spyOn(prismaClient, "withRLSContextAsAdmin").mockImplementation((fn: any) => fn(prismaMock));

    const prismaSpy = vi.spyOn(prismaClient, "getPrisma").mockReturnValue(prismaMock as any);

    return { supabaseMock, prismaMock, prismaSpy };
}