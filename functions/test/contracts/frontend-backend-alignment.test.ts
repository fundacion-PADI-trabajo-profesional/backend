import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readFrontendApiFile(fileName: string): string {
  const frontendRoot = process.env.FRONTEND_ROOT ?? join(process.cwd(), "..", "..", "frontend");
  const fullPath = join(frontendRoot, "src", "api", fileName);
  return readFileSync(fullPath, "utf8");
}

function extractBlockByAnchor(source: string, anchor: string): string {
  const fnStart = source.indexOf(anchor);
  if (fnStart === -1) {
    throw new Error(`No se encontró el bloque con ancla: ${anchor}`);
  }

  const paramsOpen = source.indexOf("(", fnStart);
  if (paramsOpen === -1) throw new Error(`No se encontró paréntesis para ancla: ${anchor}`);

  let parenDepth = 0;
  let paramsClose = -1;
  for (let i = paramsOpen; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") parenDepth += 1;
    if (ch === ")") parenDepth -= 1;
    if (parenDepth === 0) {
      paramsClose = i;
      break;
    }
  }
  if (paramsClose === -1) throw new Error(`No se pudo cerrar firma para ancla: ${anchor}`);

  const bodyOpen = source.indexOf("{", paramsClose);
  if (bodyOpen === -1) throw new Error(`No se encontró bloque para ancla: ${anchor}`);

  let braceDepth = 0;
  for (let i = bodyOpen; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") braceDepth += 1;
    if (ch === "}") braceDepth -= 1;
    if (braceDepth === 0) return source.slice(fnStart, i + 1);
  }

  throw new Error(`No se pudo cerrar el bloque para ancla: ${anchor}`);
}

describe("Frontend/Backend contract alignment", () => {

  //evaluaciones

  it("eliminarEvaluacionInstancia usa usuario_id/rol en query params", () => {
    const src = readFrontendApiFile("evaluaciones.ts");
    const fn = extractBlockByAnchor(src, "export async function eliminarEvaluacionInstancia");

    expect(fn).toContain('params.append("usuario_id"');
    expect(fn).toContain('params.append("rol"');
    expect(fn).not.toContain('params.append("userId"');
    expect(fn).not.toContain('params.append("userRole"');
  });

  //aulas.ts

  it("api/aulas.asignarEstudianteAula llama ruta backend correcta", () => {
    const src = readFrontendApiFile("aulas.ts");
    const fn = extractBlockByAnchor(src, "export const asignarEstudianteAula");

    expect(fn).toContain('api.post(`/aulas/${aulaId}/asignar-estudiante`, payload)');
    expect(fn).toContain("estudiante_id");
    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
  });

  it("api/aulas.desasignarEstudianteAula llama ruta backend correcta", () => {
    const src = readFrontendApiFile("aulas.ts");
    const fn = extractBlockByAnchor(src, "export const desasignarEstudianteAula");

    expect(fn).toContain('api.post(`/aulas/${aulaId}/desasignar-estudiante`, payload)');
    expect(fn).toContain("estudiante_id");
    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
  });

  //escuelas.ts

  it("escuelas.createEscuela envia usuario_id y rol en el body (snake_case)", () => {
    const src = readFrontendApiFile("escuelas.ts");
    const fn = extractBlockByAnchor(src, "export const createEscuela");

    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
    expect(fn).not.toContain("userId");
    expect(fn).not.toContain("userRole");
    expect(fn).toContain('api.post("/escuelas"');
  });

  it("escuelas.updateEscuela envia usuario_id y rol en el body (snake_case)", () => {
    const src = readFrontendApiFile("escuelas.ts");
    const fn = extractBlockByAnchor(src, "export const updateEscuela");

    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
    expect(fn).toContain("api.put(`/escuelas/${id}`");
  });

  it("escuelas.deleteEscuela envia rol y usuario_id como query params", () => {
    const src = readFrontendApiFile("escuelas.ts");
    const fn = extractBlockByAnchor(src, "export const deleteEscuela");

    expect(fn).toContain("rol=");
    expect(fn).toContain("usuario_id=");
    expect(fn).toContain("/escuelas/");
  });

  it("escuelas.asignarDirectivo envia escuelaId y usuarioId al backend", () => {
    const src = readFrontendApiFile("escuelas.ts");
    const fn = extractBlockByAnchor(src, "export const asignarDirectivo");

    expect(fn).toContain("escuelaId");
    expect(fn).toContain("usuarioId");
    expect(fn).toContain('"/escuelas/asignar-directivo"');
  });

  //estudiantes.ts

  it("estudiantes.createEstudiante envia usuario_id y rol en el body (snake_case)", () => {
    const src = readFrontendApiFile("estudiantes.ts");
    const fn = extractBlockByAnchor(src, "export const createEstudiante");

    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
    expect(fn).not.toContain('"userId"');
    expect(fn).not.toContain('"userRole"');
    expect(fn).toContain("/estudiantes");
  });

  it("estudiantes.bulkCreateEstudiantes envia usuario_id, rol y escuela_id", () => {
    const src = readFrontendApiFile("estudiantes.ts");
    const fn = extractBlockByAnchor(src, "export async function bulkCreateEstudiantes");

    expect(fn).toContain("usuario_id");
    expect(fn).toContain("rol");
    expect(fn).toContain("escuela_id");
    expect(fn).toContain("api.post('/estudiantes/bulk'");
  });

  //auth.ts

  it("auth.requestPasswordReset llama al endpoint correcto del backend", () => {
    const src = readFrontendApiFile("auth.ts");
    const fn = extractBlockByAnchor(src, "export async function requestPasswordReset");

    expect(fn).toContain("/auth/reset-password-request");
    expect(fn).toContain("email");
  });

  it("auth.updatePasswordUser envia accessToken, refreshToken y newPassword", () => {
    const src = readFrontendApiFile("auth.ts");
    const fn = extractBlockByAnchor(src, "export async function updatePasswordUser");

    expect(fn).toContain("accessToken");
    expect(fn).toContain("refreshToken");
    expect(fn).toContain("newPassword");
    expect(fn).toContain("/auth/update-password");
  });

  it("auth.updateProfileData llama a PUT /auth/profile con userId", () => {
    const src = readFrontendApiFile("auth.ts");
    const fn = extractBlockByAnchor(src, "export async function updateProfileData");

    expect(fn).toContain("userId");
    expect(fn).toContain("/auth/profile");
    expect(fn).toContain("nombre");
    expect(fn).toContain("apellido");
  });

  // export de evaluaciones

  it("getExportEvaluaciones usa la ruta y el query param del backend", () => {
    const src = readFrontendApiFile("estadisticas.ts");
    const fn = extractBlockByAnchor(src, "export async function getExportEvaluaciones");

    expect(fn).toContain("/estadisticas/padi/export-evaluaciones");
    expect(fn).toContain("periodo=");
  });
});
