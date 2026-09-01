import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { mockAuthAs } from "./helpers/auth-mock"; // Importar el helper

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aulas endpoints", () => {
  // Payload ahora solo contiene datos de negocio, no de identidad
  const payloadOk = {
    sala_id: 3,
    comision: "Delfines",
    turno: "mañana",
  };

  it("GET /aulas returns list for director", async () => {
    // 1. Mock de autenticación como Director
    const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

    // 2. Mocks específicos para el repositorio de aulas
    prismaMock.aulas = {
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
    };

    // 3. Petición limpia con Header
    const res = await request(app)
      .get("/aulas")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(res.body.data.length).toBe(1);
  });

  it("POST /aulas/:id/asignar-docente assigns a teacher", async () => {
    const aulaId = "a1";
    const profesorId = "prof-1";

    // Mock como Director
    const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

    // Extendemos el mock de Prisma
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }) };
    prismaMock.profesores = { findUnique: vi.fn().mockResolvedValue({ id: profesorId }) };
    prismaMock.profesoresEscuelas = {
      findFirst: vi.fn().mockResolvedValue({ id: "pe1", profesor_id: profesorId, escuela_id: "esc1" }),
    };
    prismaMock.profesoresAulas = {
      create: vi.fn().mockResolvedValue({ id: "pa1", profesor_id: profesorId, aula_id: aulaId }),
    };

    const res = await request(app)
      .post(`/aulas/${aulaId}/asignar-docente`)
      .set("Authorization", "Bearer fake-token")
      .send({ profesor_id: profesorId }); // Ya no enviamos usuario_id ni rol

    expect(res.status).toBe(200);
    expect(prismaMock.profesoresAulas.create).toHaveBeenCalled();
  });

  it("POST /aulas creates one (201) for director", async () => {
    // Mock como Director
    const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

    prismaMock.salas = { findUnique: vi.fn().mockResolvedValue({ id: 3 }) };
    prismaMock.aulas = {
      create: vi.fn().mockResolvedValue({ id: "a1", ...payloadOk, escuela_id: "esc1" }),
    };

    const res = await request(app)
      .post("/aulas")
      .set("Authorization", "Bearer fake-token")
      .send(payloadOk);

    expect(res.status).toBe(201);
    expect(prismaMock.aulas.create).toHaveBeenCalled();
  });

  it("PUT /aulas/:id updates aula for equipo_padi", async () => {
    const aulaId = "a1";
    // Mock como PADI
    const { prismaMock } = mockAuthAs("equipo_padi", "padi-1");

    prismaMock.aulas = {
      findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }),
      update: vi.fn().mockResolvedValue({ id: aulaId, sala_id: 4 }),
    };

    const res = await request(app)
      .put(`/aulas/${aulaId}`)
      .set("Authorization", "Bearer fake-token")
      .send({ sala_id: 4, comision: "Leones", turno: "tarde" });

    expect(res.status).toBe(200);
    expect(prismaMock.aulas.update).toHaveBeenCalled();
  });

  it("POST /aulas normaliza variantes de turno al valor canónico", async () => {
    const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

    prismaMock.salas = { findUnique: vi.fn().mockResolvedValue({ id: 3 }) };
    prismaMock.aulas = {
      create: vi.fn().mockResolvedValue({ id: "a1", sala_id: 3, comision: "Delfines", turno: "Mañana", escuela_id: "esc1" }),
    };

    const res = await request(app)
      .post("/aulas")
      .set("Authorization", "Bearer fake-token")
      .send({ sala_id: 3, comision: "Delfines", turno: "manana" });

    expect(res.status).toBe(201);
    expect(prismaMock.aulas.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ turno: "Mañana" }) })
    );
  });

  it("POST /aulas con turno no reconocido → 400 con mensaje específico", async () => {
    const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

    prismaMock.salas = { findUnique: vi.fn().mockResolvedValue({ id: 3 }) };
    prismaMock.aulas = { create: vi.fn() };

    const res = await request(app)
      .post("/aulas")
      .set("Authorization", "Bearer fake-token")
      .send({ sala_id: 3, comision: "Delfines", turno: "noche" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Turno inválido: usar Mañana, Tarde o Completo");
    expect(prismaMock.aulas.create).not.toHaveBeenCalled();
  });

  it("PUT /aulas/:id normaliza variantes de turno al valor canónico", async () => {
    const aulaId = "a1";
    const { prismaMock } = mockAuthAs("equipo_padi", "padi-1");

    prismaMock.aulas = {
      findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }),
      update: vi.fn().mockResolvedValue({ id: aulaId, turno: "Completo" }),
    };

    const res = await request(app)
      .put(`/aulas/${aulaId}`)
      .set("Authorization", "Bearer fake-token")
      .send({ turno: "COMPLETO" });

    expect(res.status).toBe(200);
    expect(prismaMock.aulas.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ turno: "Completo" }) })
    );
  });

  it("DELETE /aulas/:id deletes aula for equipo_padi", async () => {
    const aulaId = "a1";
    const { prismaMock } = mockAuthAs("equipo_padi", "padi-1");

    prismaMock.aulas = {
      findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }),
      delete: vi.fn().mockResolvedValue({ id: aulaId }),
    };
    prismaMock.estudiantesAulas = { count: vi.fn().mockResolvedValue(0) };
    prismaMock.profesoresAulas = { count: vi.fn().mockResolvedValue(0) };

    const res = await request(app)
      .delete(`/aulas/${aulaId}`)
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(prismaMock.aulas.delete).toHaveBeenCalled();
  });

  it("POST /aulas returns 400 when required fields are missing", async () => {
    mockAuthAs("director"); // Necesita estar autenticado para llegar a la validación de negocio

    const res = await request(app)
      .post("/aulas")
      .set("Authorization", "Bearer fake-token")
      .send({ sala_id: 3 }); // Falta comision y turno

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /aulas returns 400 when user role is not allowed (docente)", async () => {

    mockAuthAs("docente");

    const res = await request(app)
      .post("/aulas")
      .set("Authorization", "Bearer fake-token")
      .send(payloadOk);

    expect(res.status).toBe(400);
  });

  it("GET /docentes/aulas returns assigned aulas for logged docente", async () => {
    const { prismaMock } = mockAuthAs("docente", "docente-1");

    // listByProfesor resuelve Profesores.id desde el usuario_id antes de buscar aulas
    prismaMock.profesores = {
      findFirst: vi.fn().mockResolvedValue({ id: "prof-1" }),
    };
    prismaMock.profesoresAulas = {
      findMany: vi.fn().mockResolvedValue([
        {
          aula: {
            id: "a1",
            comision: "Delfines",
            escuela: { nombre: "Escuela Norte" },
            estudiantes_aulas: [],
            sala: { grado: 3 },
          },
        },
      ]),
    };

    const res = await request(app)
      .get("/docentes/aulas")
      .set("Authorization", "Bearer fake-token");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe("a1");
  });
});
it("GET /aulas/:id/estudiantes returns students for a director aula", async () => {
  const aulaId = "a1";
  // 1. Mockeamos la sesión del Director y su escuela asignada
  const { prismaMock } = mockAuthAs("director", "director-1", { escuela_id: "esc1" });

  // 2. Configuramos los mocks de datos necesarios para el servicio
  prismaMock.aulas = {
    findUnique: vi.fn().mockResolvedValue({
      id: aulaId,
      escuela_id: "esc1", // El ID debe coincidir con el del director para que el servicio dé permiso
    }),
  };

  prismaMock.estudiantesAulas = {
    findMany: vi.fn().mockResolvedValue([
      {
        estudiante: {
          id: "s1",
          personas: { nombre: "Juan", primer_apellido: "Perez" },
          // ... otros campos si el repositorio los requiere
        },
      },
    ]),
  };

  // 3. Request limpio con el token JWT
  const res = await request(app)
    .get(`/aulas/${aulaId}/estudiantes`)
    .set("Authorization", "Bearer fake-token");

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, message: "ok" });
  expect(res.body.data[0]).toMatchObject({
    id: "s1",
    personas: { nombre: "Juan", primer_apellido: "Perez" },
  });
});

it("POST /aulas/:id/asignar-estudiante allows equipo_padi", async () => {
  const aulaId = "a1";
  const estudianteId = "s1";

  // 1. Mockeamos como equipo_padi
  const { prismaMock } = mockAuthAs("equipo_padi", "padi-1");

  prismaMock.aulas = {
    findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }),
  };
  prismaMock.estudiantes = {
    findFirst: vi.fn().mockResolvedValue({ id: estudianteId, escuela_id: "esc1" }),
  };
  prismaMock.estudiantesAulas = {
    findFirst: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    create: vi.fn().mockResolvedValue({ id: "ea1", estudiante_id: estudianteId, aula_id: aulaId }),
  };

  // 2. Enviamos solo los datos de negocio (estudiante_id)
  const res = await request(app)
    .post(`/aulas/${aulaId}/asignar-estudiante`)
    .set("Authorization", "Bearer fake-token")
    .send({ estudiante_id: estudianteId });

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true });
  expect(prismaMock.estudiantesAulas.create).toHaveBeenCalled();
});

it("POST /aulas/:id/desasignar-estudiante allows equipo_padi", async () => {
  const aulaId = "a1";
  const estudianteId = "s1";

  // 1. Mockeamos la sesión
  const { prismaMock } = mockAuthAs("equipo_padi", "padi-1");

  prismaMock.aulas = {
    findUnique: vi.fn().mockResolvedValue({ id: aulaId, escuela_id: "esc1" }),
  };
  prismaMock.estudiantesAulas = {
    findFirst: vi.fn().mockResolvedValue({
      id: "ea1",
      estudiante_id: estudianteId,
      aula_id: aulaId,
      fecha_fin: null,
    }),
    update: vi.fn().mockResolvedValue({ id: "ea1", fecha_fin: new Date() }),
  };

  // 2. Petición autenticada y limpia
  const res = await request(app)
    .post(`/aulas/${aulaId}/desasignar-estudiante`)
    .set("Authorization", "Bearer fake-token")
    .send({ estudiante_id: estudianteId });

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true });
  expect(prismaMock.estudiantesAulas.update).toHaveBeenCalled();
});

describe("aulas - error and validation branches", () => {
  it("POST /aulas/:id/asignar-estudiante returns 400 when estudiante_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/aulas/a-1/asignar-estudiante")
      .set("Authorization", "Bearer fake-token")
      .send({}); // missing estudiante_id
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/desasignar-estudiante returns 400 when estudiante_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/aulas/a-1/desasignar-estudiante")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("GET /docentes/aulas returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("docente");
    prismaMock.profesoresAulas = {
      findMany: vi.fn().mockRejectedValue(new Error("DB error")),
    };
    const res = await request(app)
      .get("/docentes/aulas")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/asignar-estudiante returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) }; // causes service to throw
    const res = await request(app)
      .post("/aulas/a-1/asignar-estudiante")
      .set("Authorization", "Bearer fake-token")
      .send({ estudiante_id: "s-1" });
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/desasignar-estudiante returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) };
    const res = await request(app)
      .post("/aulas/a-1/desasignar-estudiante")
      .set("Authorization", "Bearer fake-token")
      .send({ estudiante_id: "s-1" });
    expect(res.status).toBe(400);
  });

  it("GET /aulas/:id/estudiantes returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("director", "dir-1", { escuela_id: "esc-1" });
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) }; // causes service to throw
    const res = await request(app)
      .get("/aulas/a-1/estudiantes")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});

describe("aulas - listDocentes and desasignarDocente", () => {
  it("GET /aulas/:id/docentes returns 200 with docentes list", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue({ id: "a-1", escuela_id: "esc-1" }) };
    prismaMock.profesoresAulas = { findMany: vi.fn().mockResolvedValue([]) };
    const res = await request(app)
      .get("/aulas/a-1/docentes")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
  });

  it("GET /aulas/:id/docentes returns 500 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockRejectedValue(new Error("DB error")) };
    const res = await request(app)
      .get("/aulas/a-1/docentes")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(500);
  });

  it("POST /aulas/:id/asignar-docente returns 400 when profesor_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/aulas/a-1/asignar-docente")
      .set("Authorization", "Bearer fake-token")
      .send({}); // missing profesor_id
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/asignar-docente returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) };
    const res = await request(app)
      .post("/aulas/a-1/asignar-docente")
      .set("Authorization", "Bearer fake-token")
      .send({ profesor_id: "prof-1" });
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/desasignar-docente returns 400 when profesor_id is missing", async () => {
    mockAuthAs("equipo_padi");
    const res = await request(app)
      .post("/aulas/a-1/desasignar-docente")
      .set("Authorization", "Bearer fake-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /aulas/:id/desasignar-docente returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) };
    const res = await request(app)
      .post("/aulas/a-1/desasignar-docente")
      .set("Authorization", "Bearer fake-token")
      .send({ profesor_id: "prof-1" });
    expect(res.status).toBe(400);
  });

  it("DELETE /aulas/:id returns 400 when service throws", async () => {
    const { prismaMock } = mockAuthAs("equipo_padi");
    prismaMock.aulas = { findUnique: vi.fn().mockResolvedValue(null) };
    const res = await request(app)
      .delete("/aulas/a-1")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(400);
  });
});