import { describe, it, expect } from "vitest";
import { buildReporteEscuela } from "../src/services/reporte-escuela.calc";
import { mkEval, mkResp, mkInput, ESCUELA } from "./fixtures/reporte-escuela";

const sala5 = (r: ReturnType<typeof buildReporteEscuela>) => r.salas.find((s) => s.sala_id === 5)!;

describe("buildReporteEscuela — encabezado y catálogos", () => {
  it("devuelve escuela, periodo, generado_en ISO y las áreas ordenadas", () => {
    const r = buildReporteEscuela(mkInput([]));
    expect(r.escuela).toEqual(ESCUELA);
    expect(r.periodo).toBe(2025);
    expect(r.generado_en).toBe("2026-09-01T12:00:00.000Z");
    expect(r.areas.map((a) => a.id)).toEqual(["sm", "cl", "cog", "se"]);
    expect(r.salas).toEqual([]);
    expect(r.resumen).toEqual({ inicial: null, cierre: null, comparativo: null });
  });
});

describe("buildReporteEscuela — modo inicial", () => {
  const input = mkInput([
    mkEval({ id: "e1", est: "a", tipo: "inicial", apellido: "Gómez", nombre: "Olivia" }),
    mkEval({ id: "e2", est: "b", tipo: "inicial", desaprueba: ["sm"], apellido: "Benítez", apellido2: "Ruiz", nombre: "Malena" }),
    mkEval({ id: "e3", est: "c", tipo: "inicial", desaprueba: ["sm", "cl"], apellido: "Cáceres", nombre: "Thiago" }),
  ]);
  const s = sala5(buildReporteEscuela(input));

  it("cuenta evaluados y aprobados con estado_id global", () => {
    expect(s.sala).toBe("Sala de 5");
    expect(s.inicial!.evaluados).toBe(3);
    expect(s.inicial!.aprobados).toBe(1);
    expect(s.inicial!.cierra_con).toBeNull();
    expect(s.cierre).toBeNull();
  });
  it("cuenta por área en el orden del catálogo", () => {
    expect(s.inicial!.por_area).toEqual([
      { area_id: "sm", evaluados: 3, aprobados: 1 },
      { area_id: "cl", evaluados: 3, aprobados: 2 },
      { area_id: "cog", evaluados: 3, aprobados: 3 },
      { area_id: "se", evaluados: 3, aprobados: 3 },
    ]);
  });
  it("arma la nómina ordenada por severidad y apellido, con nombre 'Apellidos, Nombre'", () => {
    expect(s.inicial!.estudiantes.map((e) => e.nombre)).toEqual(["Cáceres, Thiago", "Benítez Ruiz, Malena", "Gómez, Olivia"]);
    expect(s.inicial!.estudiantes[0]).toMatchObject({ estudiante_id: "c", aprobado: false, areas: { sm: "D", cl: "D", cog: "A", se: "A" } });
    expect(s.inicial!.estudiantes[2].aprobado).toBe(true);
  });
  it("sin respuestas, las pautas vienen vacías por área", () => {
    expect(s.inicial!.pautas).toEqual([
      { area_id: "sm", items: [] }, { area_id: "cl", items: [] }, { area_id: "cog", items: [] }, { area_id: "se", items: [] },
    ]);
  });
});

describe("buildReporteEscuela — deduplicación y sin dato", () => {
  it("con dos iniciales del mismo estudiante vale la más reciente", () => {
    const r = buildReporteEscuela(mkInput([
      mkEval({ id: "e1", est: "a", tipo: "inicial", desaprueba: ["sm"], fecha: "2025-03-01T00:00:00Z" }),
      mkEval({ id: "e2", est: "a", tipo: "inicial", fecha: "2025-05-01T00:00:00Z" }),
    ]));
    expect(sala5(r).inicial!.evaluados).toBe(1);
    expect(sala5(r).inicial!.aprobados).toBe(1);
  });
  it("un área sin registro es null y no cuenta en su denominador", () => {
    const r = buildReporteEscuela(mkInput([
      mkEval({ id: "e1", est: "a", tipo: "inicial", omitir: ["se"] }),
      mkEval({ id: "e2", est: "b", tipo: "inicial" }),
    ]));
    const ini = sala5(r).inicial!;
    expect(ini.por_area.find((p) => p.area_id === "se")).toEqual({ area_id: "se", evaluados: 1, aprobados: 1 });
    expect(ini.estudiantes.find((e) => e.estudiante_id === "a")!.areas.se).toBeNull();
  });
  it("si falta nombre, usa 'Sin nombre'", () => {
    const ev = mkEval({ id: "e1", est: "a", tipo: "inicial" });
    ev.estudiantes.personas = { nombre: null, primer_apellido: null, segundo_apellido: null };
    expect(sala5(buildReporteEscuela(mkInput([ev]))).inicial!.estudiantes[0].nombre).toBe("Sin nombre");
  });
});

describe("buildReporteEscuela — cierre y comparativo", () => {
  // a aprobó la inicial; b no pasó (sm) y recuperó; c no pasó (sm, cl): sigue sm, recupera cl, desaprueba se (nueva);
  // d no pasó (sm) y no tiene cierre; e aprobó la inicial pero tiene un cierre cargado (se ignora en el comparativo).
  const input = mkInput([
    mkEval({ id: "ia", est: "a", tipo: "inicial", apellido: "Acosta" }),
    mkEval({ id: "ib", est: "b", tipo: "inicial", desaprueba: ["sm"], apellido: "Benítez" }),
    mkEval({ id: "ic", est: "c", tipo: "inicial", desaprueba: ["sm", "cl"], apellido: "Cáceres" }),
    mkEval({ id: "id", est: "d", tipo: "inicial", desaprueba: ["sm"], apellido: "Díaz" }),
    mkEval({ id: "ie", est: "e", tipo: "inicial", apellido: "Escobar" }),
    mkEval({ id: "cb", est: "b", tipo: "cierre", apellido: "Benítez" }),
    mkEval({ id: "cc", est: "c", tipo: "cierre", desaprueba: ["sm", "se"], apellido: "Cáceres" }),
    mkEval({ id: "ce", est: "e", tipo: "cierre", desaprueba: ["cog"], apellido: "Escobar" }),
  ]);
  const s = sala5(buildReporteEscuela(input));

  it("modo cierre: universo = quienes tienen cierre; cierra_con cuenta inicial ∪ cierre", () => {
    expect(s.cierre!.evaluados).toBe(3);      // b, c, e
    expect(s.cierre!.aprobados).toBe(1);      // b
    expect(s.cierre!.cierra_con).toEqual({ aprobados: 3, total: 5 }); // a, e (inicial) + b (cierre) de 5
  });
  it("comparativo: contadores", () => {
    expect(s.comparativo).toMatchObject({
      base: 5, aprobaron_inicial: 2, reevaluados: 2, recuperaron: 1, persisten: 1, pendientes: 1, cierra_con: 3,
    });
  });
  it("comparativo: estudiantes solo los que no aprobaron la inicial, con estado por área", () => {
    const est = s.comparativo!.estudiantes;
    expect(est.map((e) => [e.estudiante_id, e.resultado])).toEqual([["c", "persiste"], ["b", "recupero"], ["d", "pendiente"]]);
    expect(est[0].areas).toEqual({ sm: "persiste", cl: "recupero", cog: "ok", se: "nueva" });
    expect(est[1].areas).toEqual({ sm: "recupero", cl: "ok", cog: "ok", se: "ok" });
    expect(est[2].areas).toEqual({ sm: "pendiente", cl: "pendiente", cog: "pendiente", se: "pendiente" });
  });
  it("comparativo: por área (quien aprobó la inicial cuenta con su estado inicial)", () => {
    const sm = s.comparativo!.por_area.find((p) => p.area_id === "sm")!;
    expect(sm).toEqual({ area_id: "sm", aprobados_inicial: 2, aprobados_cierre: 3, sin_dato: 1 }); // a, e + b; d pendiente
    const se = s.comparativo!.por_area.find((p) => p.area_id === "se")!;
    expect(se).toEqual({ area_id: "se", aprobados_inicial: 5, aprobados_cierre: 3, sin_dato: 1 }); // c nueva, d pendiente
  });
});

describe("buildReporteEscuela — salas sin inicial y estudiante solo con cierre", () => {
  it("sala solo con cierre: inicial y comparativo null, cierre presente", () => {
    const r = buildReporteEscuela(mkInput([mkEval({ id: "c1", est: "z", tipo: "cierre", sala: 4 })]));
    const s4 = r.salas.find((s) => s.sala_id === 4)!;
    expect(s4.inicial).toBeNull();
    expect(s4.comparativo).toBeNull();
    expect(s4.cierre!.evaluados).toBe(1);
    expect(s4.cierre!.cierra_con).toEqual({ aprobados: 1, total: 1 });
  });
  it("un estudiante con cierre pero sin inicial entra en cierre y no en el comparativo", () => {
    const r = buildReporteEscuela(mkInput([
      mkEval({ id: "i1", est: "a", tipo: "inicial", desaprueba: ["sm"] }),
      mkEval({ id: "c1", est: "z", tipo: "cierre" }),
    ]));
    const s = sala5(r);
    expect(s.cierre!.evaluados).toBe(1);
    expect(s.comparativo!.base).toBe(1);
    expect(s.comparativo!.estudiantes.map((e) => e.estudiante_id)).toEqual(["a"]);
  });
});

describe("buildReporteEscuela — pautas", () => {
  const evals = [
    mkEval({ id: "e1", est: "a", tipo: "inicial" }),
    mkEval({ id: "e2", est: "b", tipo: "inicial" }),
    mkEval({ id: "e3", est: "c", tipo: "inicial" }),
  ];
  // Pauta 1 (2 sub-preguntas), pauta 2 (1 sub-pregunta invertida), pauta 3 (2 sub-preguntas, e3 la deja incompleta),
  // pauta 9 inactiva (se ignora).
  const resp = [
    ...["e1", "e2", "e3"].flatMap((ev) => [
      mkResp({ eval: ev, area: "sm", pregunta: "p1a", numero: 1, respuesta: ev === "e1" ? 1 : 0, titulo: "Salta en un pie" }),
      mkResp({ eval: ev, area: "sm", pregunta: "p1b", numero: 1, respuesta: 0, titulo: "Salta en un pie" }),
      mkResp({ eval: ev, area: "sm", pregunta: "p2", numero: 2, respuesta: ev === "e3" ? 1 : 0, invertida: true, consigna: "Se golpea al caminar" }),
      mkResp({ eval: ev, area: "sm", pregunta: "p3a", numero: 3, respuesta: 1 }),
      mkResp({ eval: ev, area: "sm", pregunta: "p3b", numero: 3, respuesta: ev === "e3" ? null : 1 }),
      mkResp({ eval: ev, area: "sm", pregunta: "p9", numero: 9, respuesta: 0, activa: false }),
    ]),
  ];
  const s = sala5(buildReporteEscuela(mkInput(evals, resp)));
  const sm = s.inicial!.pautas.find((p) => p.area_id === "sm")!;

  it("aplica la regla de pauta, respeta invertidas, excluye incompletas e inactivas, y ordena por desaprobados", () => {
    expect(sm.items).toEqual([
      { numero: 1, texto: "Salta en un pie", desaprobaron: 2, evaluados: 3 },      // e2 y e3: 0 de 2 correctas
      { numero: 2, texto: "Se golpea al caminar", desaprobaron: 1, evaluados: 3 }, // invertida: e3 respondió 1
      { numero: 3, texto: "Consigna 3", desaprobaron: 0, evaluados: 2 },           // e3 incompleta → fuera del denominador
    ]);
  });
  it("devuelve como máximo 3 ítems por área y usa titulo ?? consigna", () => {
    expect(sm.items.length).toBeLessThanOrEqual(3);
    expect(sm.items[2].texto).toBe("Consigna 3");
  });
  it("las pautas del comparativo son las del cierre", () => {
    const r = buildReporteEscuela(mkInput([
      mkEval({ id: "i1", est: "a", tipo: "inicial", desaprueba: ["sm"] }),
      mkEval({ id: "c1", est: "a", tipo: "cierre", desaprueba: ["sm"] }),
    ], [
      mkResp({ eval: "i1", area: "sm", pregunta: "p1", numero: 1, respuesta: 0 }),
      mkResp({ eval: "c1", area: "sm", pregunta: "p1", numero: 1, respuesta: 1 }),
    ]));
    const s5 = sala5(r);
    expect(s5.inicial!.pautas[0].items[0].desaprobaron).toBe(1);
    expect(s5.comparativo!.pautas[0].items[0]).toEqual({ numero: 1, texto: "Consigna 1", desaprobaron: 0, evaluados: 1 });
  });
});

describe("buildReporteEscuela — resumen de escuela", () => {
  it("suma las salas presentes y arma por_sala", () => {
    const r = buildReporteEscuela(mkInput([
      mkEval({ id: "e1", est: "a", tipo: "inicial", sala: 3 }),
      mkEval({ id: "e2", est: "b", tipo: "inicial", sala: 3, desaprueba: ["cl"] }),
      mkEval({ id: "e3", est: "c", tipo: "inicial", sala: 5, desaprueba: ["sm"] }),
      mkEval({ id: "c3", est: "c", tipo: "cierre", sala: 5 }),
    ]));
    expect(r.salas.map((s) => s.sala_id)).toEqual([3, 5]);
    expect(r.resumen.inicial).toMatchObject({ evaluados: 3, aprobados: 1 });
    expect(r.resumen.inicial!.por_area.find((p) => p.area_id === "cl")).toEqual({ area_id: "cl", evaluados: 3, aprobados: 2 });
    expect(r.resumen.inicial!.por_sala.map((s) => [s.sala, s.evaluados, s.aprobados])).toEqual([["Sala de 3", 2, 1], ["Sala de 5", 1, 0]]);
    expect(r.resumen.cierre).toMatchObject({ evaluados: 1, aprobados: 1, cierra_con: { aprobados: 2, total: 3 } });
    // Nota del implementador: en Sala de 3, `b` no pasó la inicial (cl) y no tiene cierre → es pendiente, no persiste.
    expect(r.resumen.comparativo).toMatchObject({ base: 3, aprobaron_inicial: 1, reevaluados: 1, recuperaron: 1, persisten: 0, pendientes: 1, cierra_con: 2 });
    expect(r.resumen.comparativo!.por_sala.find((s) => s.sala_id === 3)).toMatchObject({ base: 2, aprobaron_inicial: 1, pendientes: 1, persisten: 0 });
  });
});
