import { describe, it, expect } from "vitest";
import { apruebaPauta, pautaCompleta, esRespuestaCorrecta, claveGrupoPauta } from "../../src/utils/pautas";

describe("esRespuestaCorrecta", () => {
  it("pregunta normal: 1 es correcta, 0 no", () => {
    expect(esRespuestaCorrecta(1, false)).toBe(true);
    expect(esRespuestaCorrecta(0, false)).toBe(false);
  });
  it("pregunta invertida: 0 es correcta, 1 no", () => {
    expect(esRespuestaCorrecta(0, true)).toBe(true);
    expect(esRespuestaCorrecta(1, true)).toBe(false);
  });
  it("sin respuesta nunca es correcta (invertida o no)", () => {
    expect(esRespuestaCorrecta(null, true)).toBe(false);
    expect(esRespuestaCorrecta(undefined, false)).toBe(false);
  });
  it("puntaje_invertido null cuenta como no invertida", () => {
    expect(esRespuestaCorrecta(1, null)).toBe(true);
  });
});

describe("apruebaPauta", () => {
  it("aprueba con al menos la mitad redondeada hacia arriba", () => {
    expect(apruebaPauta({ total: 1, correctas: 1 })).toBe(true);
    expect(apruebaPauta({ total: 1, correctas: 0 })).toBe(false);
    expect(apruebaPauta({ total: 2, correctas: 1 })).toBe(true);
    expect(apruebaPauta({ total: 3, correctas: 1 })).toBe(false);
    expect(apruebaPauta({ total: 3, correctas: 2 })).toBe(true);
    expect(apruebaPauta({ total: 4, correctas: 2 })).toBe(true);
  });
});

describe("pautaCompleta", () => {
  it("completa solo si respondió todas las sub-preguntas", () => {
    expect(pautaCompleta({ total: 3, respondidas: 3 })).toBe(true);
    expect(pautaCompleta({ total: 3, respondidas: 2 })).toBe(false);
    expect(pautaCompleta({ total: 0, respondidas: 0 })).toBe(false);
  });
});

describe("claveGrupoPauta", () => {
  it("agrupa por numero y cae al id cuando numero es null", () => {
    expect(claveGrupoPauta({ id: "p-1", numero: 7 })).toBe("7");
    expect(claveGrupoPauta({ id: "p-1", numero: null })).toBe("Q:p-1");
  });
});
