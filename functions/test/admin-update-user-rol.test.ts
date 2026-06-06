/**
 * TEST: AdminService.updateUserRol — provisión de entidad del rol nuevo
 * y limpieza (soft) del alcance del rol viejo en cada transición.
 *
 * Prisma se mockea (igual que el resto del suite). Se asierta QUÉ operaciones
 * de DB ocurren en cada transición, sin tocar una DB real.
 *
 * Spec acordado:
 *  - Al ENTRAR a docente: crear personas + profesores (idempotente).
 *  - Al ENTRAR a encargado_zona: crear encargados (idempotente).
 *  - Al SALIR de director: usuarioPerfil.escuela_id = null.
 *  - Al SALIR de docente: soft-delete (fecha_fin=now) de profesores_escuelas y profesores_aulas activas.
 *  - Al SALIR de encargado_zona: encargados.zona_id = null.
 *  - NUNCA hard-delete de profesores/personas (preserva evaluaciones e histórico de stats).
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { AdminService } from "../src/services/admin.service";
import * as prismaClient from "../src/config/prismaClient";

/** Mock de Prisma con solo los modelos/métodos que usa updateUserRol. */
function buildMock(
  user: any,
  opts: { profesor?: any; persona?: any; encargado?: any } = {}
) {
  return {
    usuarioPerfil: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ ...user, ...data })),
    },
    profesores: {
      findUnique: vi.fn().mockResolvedValue(opts.profesor ?? null),
      create: vi.fn().mockResolvedValue({ id: user?.id }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    personas: {
      findFirst: vi.fn().mockResolvedValue(opts.persona ?? null),
      create: vi.fn().mockResolvedValue({ id: "persona-id" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    profesoresEscuelas: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    profesoresAulas: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    encargados: {
      findUnique: vi.fn().mockResolvedValue(opts.encargado ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function spyTx(mock: any) {
  vi.spyOn(prismaClient, "withRLSContext").mockImplementation(async (fn: any) => fn(mock));
}

describe("AdminService.updateUserRol — transiciones", () => {
  afterEach(() => vi.restoreAllMocks());

  it("director → docente: limpia escuela_id y crea personas + profesores", async () => {
    const user = { id: "u1", rol: "director", escuela_id: "esc-1", nombre: "Nacho", apellido: "Prueba" };
    const mock = buildMock(user);
    spyTx(mock);

    await AdminService.updateUserRol("u1", "docente");

    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ escuela_id: null }) })
    );
    // la persona toma el nombre actual de usuarioPerfil ("Nacho Prueba")
    expect(mock.personas.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usuario_id: "u1", nombre: "Nacho", primer_apellido: "Prueba" } })
    );
    // profesores.id == usuario.id (convención del sistema)
    expect(mock.profesores.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: "u1", persona_id: "persona-id" } })
    );
    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "docente" }) })
    );
  });

  it("docente → director: soft-delete de asignaciones activas, sin borrar profesores/personas", async () => {
    const user = { id: "u2", rol: "docente", nombre: "X", apellido: "Y" };
    const mock = buildMock(user);
    spyTx(mock);

    await AdminService.updateUserRol("u2", "director");

    expect(mock.profesoresEscuelas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profesor_id: "u2", fecha_fin: null },
        data: expect.objectContaining({ fecha_fin: expect.any(Date) }),
      })
    );
    expect(mock.profesoresAulas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profesor_id: "u2", fecha_fin: null },
        data: expect.objectContaining({ fecha_fin: expect.any(Date) }),
      })
    );
    // jamás hard-delete (preserva evaluaciones / histórico de estadísticas)
    expect(mock.profesores.deleteMany).not.toHaveBeenCalled();
    expect(mock.personas.deleteMany).not.toHaveBeenCalled();
    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "director" }) })
    );
  });

  it("encargado_zona → docente: limpia zona_id y provisiona docente", async () => {
    const user = { id: "u3", rol: "encargado_zona", nombre: "E", apellido: "Z" };
    const mock = buildMock(user);
    spyTx(mock);

    await AdminService.updateUserRol("u3", "docente");

    expect(mock.encargados.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuario_id: "u3" }, data: { zona_id: null } })
    );
    expect(mock.profesores.create).toHaveBeenCalled();
    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "docente" }) })
    );
  });

  it("director → encargado_zona: limpia escuela_id y crea encargados", async () => {
    const user = { id: "u4", rol: "director", escuela_id: "esc-9", nombre: "D", apellido: "R" };
    const mock = buildMock(user);
    spyTx(mock);

    await AdminService.updateUserRol("u4", "encargado_zona");

    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ escuela_id: null }) })
    );
    expect(mock.encargados.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usuario_id: "u4" } })
    );
  });

  it("a docente idempotente: si ya existe profesor, no duplica persona ni profesor", async () => {
    const user = { id: "u5", rol: "director", escuela_id: "e", nombre: "N", apellido: "P" };
    const mock = buildMock(user, { profesor: { id: "u5" } });
    spyTx(mock);

    await AdminService.updateUserRol("u5", "docente");

    expect(mock.personas.create).not.toHaveBeenCalled();
    expect(mock.profesores.create).not.toHaveBeenCalled();
    expect(mock.usuarioPerfil.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "docente" }) })
    );
  });

  it("no-op si el rol nuevo es igual al actual", async () => {
    const user = { id: "u6", rol: "docente", nombre: "N", apellido: "P" };
    const mock = buildMock(user);
    spyTx(mock);

    const result = await AdminService.updateUserRol("u6", "docente");

    expect(result).toEqual({ id: "u6", rol: "docente" });
    expect(mock.usuarioPerfil.update).not.toHaveBeenCalled();
    expect(mock.profesoresEscuelas.updateMany).not.toHaveBeenCalled();
  });

  it("rol inválido lanza error", async () => {
    const mock = buildMock({ id: "u7", rol: "docente" });
    spyTx(mock);
    await expect(AdminService.updateUserRol("u7", "hacker" as any)).rejects.toThrow();
  });

  it("usuario inexistente lanza error", async () => {
    const mock = buildMock(null);
    spyTx(mock);
    await expect(AdminService.updateUserRol("nope", "docente")).rejects.toThrow();
  });
});
