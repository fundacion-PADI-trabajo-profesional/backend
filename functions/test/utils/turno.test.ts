import { describe, it, expect } from "vitest";
import { normalizarTurno, TURNOS } from "../../src/utils/turno";

describe("normalizarTurno", () => {
  it("expone TURNOS con los tres valores canónicos", () => {
    expect(TURNOS).toEqual(["Mañana", "Tarde", "Completo"]);
  });

  it.each([
    ["mañana", "Mañana"],
    ["MAÑANA ", "Mañana"],
    ["manana", "Mañana"],
    ["Tarde", "Tarde"],
    ["tarde", "Tarde"],
    ["completo", "Completo"],
    ["completa", "Completo"],
    ["Único", "Completo"],
    ["unico", "Completo"],
    ["jornada completa", "Completo"],
    ["doble", "Completo"],
  ])("normaliza %j → %j", (raw, esperado) => {
    expect(normalizarTurno(raw)).toBe(esperado);
  });

  it("no reconoce sinónimos fuera de la lista", () => {
    expect(normalizarTurno("noche")).toBeNull();
  });

  it("string vacío → null", () => {
    expect(normalizarTurno("")).toBeNull();
  });

  it("undefined → null", () => {
    expect(normalizarTurno(undefined)).toBeNull();
  });

  it("valores no-string → null", () => {
    expect(normalizarTurno(123)).toBeNull();
    expect(normalizarTurno(null)).toBeNull();
    expect(normalizarTurno({})).toBeNull();
  });
});
