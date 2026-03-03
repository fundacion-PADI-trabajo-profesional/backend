import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as prismaClient from "../src/config/prismaClient";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aulas endpoints", () => {
  const payloadOk = {
    sala_id: 3,
    comision: "Delfines",
    turno: "mañana",
    usuario_id: "director-1",
    rol: "director",
  };

  it("GET /aulas returns list for director", async () => {
    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      aulas: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a1",
            sala_id: 3,
            escuela_id: "esc1",
            comision: "Delfines",
            turno: "mañana",
            sala: { id: 3, nombre: "Sala 3", grado: 3 },
          },
        ]),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app).get(
      `/aulas?usuario_id=${payloadOk.usuario_id}&rol=${payloadOk.rol}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("POST /aulas/:id/asignar-docente assigns a teacher", async () => {
    const aulaId = "a1";
    const profesorId = "prof-1";

    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      aulas: {
        findUnique: vi.fn().mockResolvedValue({
          id: aulaId,
          escuela_id: "esc1",
        }),
      },
      profesores: {
        findUnique: vi.fn().mockResolvedValue({
          id: profesorId,
        }),
      },
      profesoresEscuelas: {
        findFirst: vi.fn().mockResolvedValue({
          id: "pe1",
          profesor_id: profesorId,
          escuela_id: "esc1",
        }),
      },
      profesoresAulas: {
        create: vi.fn().mockResolvedValue({
          id: "pa1",
          profesor_id: profesorId,
          aula_id: aulaId,
        }),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post(`/aulas/${aulaId}/asignar-docente`)
      .send({
        profesor_id: profesorId,
        usuario_id: payloadOk.usuario_id,
        rol: payloadOk.rol,
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fakePrisma.profesoresAulas.create).toHaveBeenCalled();
  });

  it("POST /aulas creates one (201) for director with escuela", async () => {
    const created = {
      id: "a1",
      sala_id: 3,
      escuela_id: "esc1",
      comision: "Delfines",
      turno: "mañana",
    };

    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      salas: {
        findUnique: vi.fn().mockResolvedValue({ id: 3 }),
      },
      aulas: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post("/aulas")
      .send(payloadOk)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.id).toBe("a1");
    expect(fakePrisma.aulas.create).toHaveBeenCalled();
  });

  it("POST /aulas returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/aulas")
      .send({
        sala_id: 3,
        // falta comision, turno, usuario_id, rol
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("POST /aulas returns 400 when user is not director", async () => {
    const res = await request(app)
      .post("/aulas")
      .send({
        ...payloadOk,
        rol: "docente",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "CREATE_ERROR" },
    });
  });

  it("GET /docentes/aulas returns assigned aulas including empty aulas", async () => {
    const docenteId = "docente-1";
    const fakePrisma = {
      profesoresAulas: {
        findMany: vi.fn().mockResolvedValue([
          {
            aula: {
              id: "a1",
              sala_id: 3,
              escuela_id: "esc1",
              comision: "Delfines",
              turno: "mañana",
              fecha_creacion: new Date().toISOString(),
              sala: { id: 3, nombre: "Sala 3", grado: 3 },
              escuela: { id: "esc1", nombre: "Escuela Norte" },
              estudiantes_aulas: [],
            },
          },
        ]),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app).get(
      `/docentes/aulas?usuario_id=${docenteId}&rol=docente`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: "a1",
      comision: "Delfines",
      escuela: { nombre: "Escuela Norte" },
      estudiantes: [],
    });
    expect(fakePrisma.profesoresAulas.findMany).toHaveBeenCalled();
  });

  it("GET /aulas/:id/estudiantes returns students for a director aula", async () => {
    const aulaId = "a1";
    const fakePrisma = {
      usuarioPerfil: {
        findUnique: vi.fn().mockResolvedValue({
          id: payloadOk.usuario_id,
          rol: "director",
          escuela_id: "esc1",
        }),
      },
      aulas: {
        findUnique: vi.fn().mockResolvedValue({
          id: aulaId,
          escuela_id: "esc1",
        }),
      },
      estudiantesAulas: {
        findMany: vi.fn().mockResolvedValue([
          {
            estudiante: {
              id: "s1",
              persona_id: "per1",
              genero_id: "M",
              grado: 3,
              sala_id: 3,
              fecha_creacion: new Date().toISOString(),
              personas: { nombre: "Juan", primer_apellido: "Perez", dni: "12345678" },
              generos: { id: "M", descripcion: "Masculino" },
              salas: { id: 3, nombre: "Sala 3", grado: 3 },
              escuela: { id: "esc1", nombre: "Escuela Norte" },
            },
          },
        ]),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app).get(
      `/aulas/${aulaId}/estudiantes?usuario_id=${payloadOk.usuario_id}&rol=${payloadOk.rol}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      id: "s1",
      personas: { nombre: "Juan", primer_apellido: "Perez" },
    });
    expect(fakePrisma.estudiantesAulas.findMany).toHaveBeenCalled();
  });

  it("POST /aulas/:id/asignar-estudiante allows equipo_padi", async () => {
    const aulaId = "a1";
    const estudianteId = "s1";
    const fakePrisma = {
      aulas: {
        findUnique: vi.fn().mockResolvedValue({
          id: aulaId,
          escuela_id: "esc1",
        }),
      },
      estudiantes: {
        findUnique: vi.fn().mockResolvedValue({
          id: estudianteId,
          escuela_id: "esc1",
        }),
      },
      estudiantesAulas: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "ea1",
          estudiante_id: estudianteId,
          aula_id: aulaId,
        }),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post(`/aulas/${aulaId}/asignar-estudiante`)
      .send({
        estudiante_id: estudianteId,
        usuario_id: "padi-1",
        rol: "equipo_padi",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fakePrisma.estudiantesAulas.create).toHaveBeenCalled();
  });

  it("POST /aulas/:id/desasignar-estudiante allows equipo_padi", async () => {
    const aulaId = "a1";
    const estudianteId = "s1";
    const fakePrisma = {
      aulas: {
        findUnique: vi.fn().mockResolvedValue({
          id: aulaId,
          escuela_id: "esc1",
        }),
      },
      estudiantesAulas: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ea1",
          estudiante_id: estudianteId,
          aula_id: aulaId,
          fecha_fin: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: "ea1",
          fecha_fin: new Date(),
        }),
      },
    };

    vi.spyOn(prismaClient, "getPrisma").mockReturnValue(fakePrisma as any);

    const res = await request(app)
      .post(`/aulas/${aulaId}/desasignar-estudiante`)
      .send({
        estudiante_id: estudianteId,
        usuario_id: "padi-1",
        rol: "equipo_padi",
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fakePrisma.estudiantesAulas.update).toHaveBeenCalled();
  });
});


