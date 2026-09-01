import { describe, it, expect } from "vitest";
import { getPeriodoRange } from "../../src/utils/periodo";

describe("getPeriodoRange", () => {
  it("devuelve el año calendario completo en UTC, fin exclusivo", () => {
    const { periodoStart, periodoEnd } = getPeriodoRange(2025);
    expect(periodoStart.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(periodoEnd.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
