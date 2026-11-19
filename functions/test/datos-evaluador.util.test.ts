import { describe, it, expect } from "vitest";
import { contextoPorEstudiante, normalizarDatosEvaluador, resumirContextoEvaluador } from "../src/utils/datos-evaluador";
import { ValidationError } from "../src/utils/errors";

describe("normalizarDatosEvaluador", () => {
  it("acepta un cierre completo y recorta las observaciones", () => {
    expect(
      normalizarDatosEvaluador(
        { sesiones_completadas: "entre_5_y_9", en_tratamiento: true, tiene_cud: false, observaciones: "  Se distrae.  " },
        "cierre",
      ),
    ).toEqual({ sesiones_completadas: "entre_5_y_9", en_tratamiento: true, tiene_cud: false, observaciones: "Se distrae." });
  });

  it("lo que no viene queda en null y las observaciones vacías también", () => {
    expect(normalizarDatosEvaluador({ observaciones: "   " }, "cierre")).toEqual({
      sesiones_completadas: null,
      en_tratamiento: null,
      tiene_cud: null,
      observaciones: null,
    });
  });

  it("en una evaluación inicial las sesiones se descartan", () => {
    expect(normalizarDatosEvaluador({ sesiones_completadas: "10_o_mas", en_tratamiento: false }, "inicial").sesiones_completadas).toBeNull();
  });

  it.each([
    [{ sesiones_completadas: "7" }],
    [{ sesiones_completadas: 7 }],
    [{ en_tratamiento: "si" }],
    [{ tiene_cud: 1 }],
    [{ observaciones: 12 }],
    [{ observaciones: "x".repeat(501) }],
    [null],
    [[]],
    ["texto"],
  ])("rechaza %j con DATOS_EVALUADOR_INVALIDOS", (body) => {
    try {
      normalizarDatosEvaluador(body, "cierre");
      expect.unreachable("debía rechazar");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).code).toBe("DATOS_EVALUADOR_INVALIDOS");
    }
  });

  it("acepta observaciones de exactamente 500 caracteres", () => {
    expect(normalizarDatosEvaluador({ observaciones: "x".repeat(500) }, "inicial").observaciones).toHaveLength(500);
  });
});

describe("resumirContextoEvaluador", () => {
  it("sin evaluaciones no hay dato", () => {
    expect(resumirContextoEvaluador([])).toEqual({ en_tratamiento: null, tiene_cud: null });
  });

  it("toma de cada dato el más reciente respondido, por separado", () => {
    expect(
      resumirContextoEvaluador([
        { en_tratamiento: null, tiene_cud: null }, // la más nueva, sin responder
        { en_tratamiento: true, tiene_cud: null },
        { en_tratamiento: false, tiene_cud: true }, // la más vieja
      ]),
    ).toEqual({ en_tratamiento: true, tiene_cud: true });
  });

  it("un 'no' más nuevo le gana a un 'sí' más viejo", () => {
    expect(resumirContextoEvaluador([{ en_tratamiento: false, tiene_cud: false }, { en_tratamiento: true, tiene_cud: true }])).toEqual({
      en_tratamiento: false,
      tiene_cud: false,
    });
  });
});

describe("contextoPorEstudiante", () => {
  it("resume cada estudiante con sus propias filas respetando el orden", () => {
    const mapa = contextoPorEstudiante([
      { estudiante_id: "a", en_tratamiento: null, tiene_cud: true },
      { estudiante_id: "b", en_tratamiento: false, tiene_cud: null },
      { estudiante_id: "a", en_tratamiento: true, tiene_cud: false },
    ]);
    expect(mapa.get("a")).toEqual({ en_tratamiento: true, tiene_cud: true });
    expect(mapa.get("b")).toEqual({ en_tratamiento: false, tiene_cud: null });
    expect(mapa.has("c")).toBe(false);
  });
});
