import { describe, it, expect } from "vitest";
import { anioDe, esTipoEvaluacion, mensajeTipoDuplicado, rangoAnioUTC } from "../src/utils/evaluaciones-tipo";
import { NotFoundError, TipoDuplicadoError, ValidationError } from "../src/utils/errors";

describe("utilidades de tipo de evaluación", () => {
  it("mensaje de duplicado inicial", () => {
    expect(mensajeTipoDuplicado("inicial", 4, new Date("2026-03-12T00:00:00Z"))).toBe(
      "Este alumno ya tiene una evaluación inicial de sala 4 cargada el 12/03/2026. " +
        "Si esta es de cierre, elegí Cierre; si la anterior está mal, cambiale el tipo o eliminala."
    );
  });

  it("mensaje de duplicado cierre", () => {
    expect(mensajeTipoDuplicado("cierre", 5, new Date("2026-11-20T00:00:00Z"))).toBe(
      "Este alumno ya tiene una evaluación de cierre de sala 5 cargada el 20/11/2026. " +
        "Si la anterior está mal, cambiale el tipo o eliminala."
    );
  });

  it("año en UTC: 31/12 a las 23:00 UTC sigue siendo 2026", () => {
    expect(anioDe(new Date("2026-12-31T23:00:00Z"))).toBe(2026);
  });

  it("rango del año en UTC", () => {
    expect(rangoAnioUTC(2026)).toEqual({
      gte: new Date("2026-01-01T00:00:00Z"),
      lt: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("tipos válidos", () => {
    expect(esTipoEvaluacion("inicial")).toBe(true);
    expect(esTipoEvaluacion("cierre")).toBe(true);
    expect(esTipoEvaluacion("final")).toBe(false);
    expect(esTipoEvaluacion(undefined)).toBe(false);
  });

  it("errores tipados exponen código y detalle", () => {
    const existente = { id: "ev-1", tipo_id: "inicial", fecha_creacion: new Date("2026-03-12T00:00:00Z") };
    const dup = new TipoDuplicadoError("ya existe", existente);
    expect(dup.code).toBe("TIPO_DUPLICADO");
    expect(dup.evaluacionExistente).toBe(existente);
    expect(dup).toBeInstanceOf(Error);
    expect(new ValidationError("mal", "TIPO_INVALIDO").code).toBe("TIPO_INVALIDO");
    expect(new NotFoundError("no está").name).toBe("NotFoundError");
  });
});
