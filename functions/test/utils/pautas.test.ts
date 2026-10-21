import { describe, it, expect } from "vitest";
import { apruebaPauta, pautaCompleta, esRespuestaCorrecta, claveGrupoPauta, minimoPauta, minimoDePartes, agruparPorPauta } from "../../src/utils/pautas";

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

  it("con mínimo cargado, aprueba con ese mínimo y no con la mitad", () => {
    expect(apruebaPauta({ total: 3, correctas: 2, minimo: 3 })).toBe(false);
    expect(apruebaPauta({ total: 3, correctas: 3, minimo: 3 })).toBe(true);
    expect(apruebaPauta({ total: 4, correctas: 2, minimo: 3 })).toBe(false);
    expect(apruebaPauta({ total: 5, correctas: 3, minimo: 4 })).toBe(false);
    expect(apruebaPauta({ total: 5, correctas: 4, minimo: 4 })).toBe(true);
  });

  it("mínimo null o undefined cae a la mitad redondeada hacia arriba", () => {
    expect(apruebaPauta({ total: 4, correctas: 2, minimo: null })).toBe(true);
    expect(apruebaPauta({ total: 5, correctas: 3, minimo: undefined })).toBe(true);
  });
});

describe("minimoPauta y minimoDePartes", () => {
  it("minimoPauta devuelve el cargado o la mitad", () => {
    expect(minimoPauta({ total: 5, minimo: 4 })).toBe(4);
    expect(minimoPauta({ total: 5 })).toBe(3);
    expect(minimoPauta({ total: 1, minimo: null })).toBe(1);
  });

  it("minimoDePartes: null si ninguna parte trae valor; si difieren, el más alto", () => {
    expect(minimoDePartes([null, undefined])).toBeNull();
    expect(minimoDePartes([3, 3, 3])).toBe(3);
    expect(minimoDePartes([null, 3, 2])).toBe(3);
    expect(minimoDePartes([])).toBeNull();
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

describe("agruparPorPauta", () => {
  const catalogo = [
    { id: "s1", numero: 1, puntaje: 1, puntaje_invertido: true },
    { id: "i1", numero: 5, puntaje: null, puntaje_invertido: false, minimo_aprobacion: 3 },
    { id: "i2", numero: 5, puntaje: 2, puntaje_invertido: false, minimo_aprobacion: 3 },
    { id: "i3", numero: 5, puntaje: 1, puntaje_invertido: null, minimo_aprobacion: null },
    { id: "x", numero: null },
  ];

  it("cuenta las partes desde el catálogo: una parte sin fila queda sin responder", () => {
    const g = agruparPorPauta(catalogo, new Map([["s1", 0], ["i1", 1], ["i2", 1]]));
    expect(g.get("5")).toEqual({ total: 3, respondidas: 2, correctas: 2, valor: 2, minimo: 3 });
    expect(g.get("1")).toEqual({ total: 1, respondidas: 1, correctas: 1, valor: 1, minimo: null });
    expect(g.get("Q:x")).toEqual({ total: 1, respondidas: 0, correctas: 0, valor: 1, minimo: null });
  });

  it("una fila con respuesta null no cuenta como respondida; una fila de una pregunta fuera del catálogo se ignora", () => {
    const g = agruparPorPauta(catalogo, new Map([["i3", null], ["vieja", 1]]));
    expect(g.get("5")).toMatchObject({ respondidas: 0, correctas: 0 });
    expect(g.size).toBe(3);
  });
});
