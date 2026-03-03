import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readFrontendApiFile(fileName: string): string {
  const fullPath = join(process.cwd(), "..", "..", "frontend", "src", "api", fileName);
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
  it("eliminarEvaluacionInstancia usa usuario_id/rol en query params", () => {
    const src = readFrontendApiFile("evaluaciones.ts");
    const fn = extractBlockByAnchor(src, "export async function eliminarEvaluacionInstancia");

    expect(fn).toContain('params.append("usuario_id"');
    expect(fn).toContain('params.append("rol"');
    expect(fn).not.toContain('params.append("userId"');
    expect(fn).not.toContain('params.append("userRole"');
  });

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
});
