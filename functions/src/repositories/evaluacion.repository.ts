import { Evaluacion } from "../interfaces/evaluacion.interface";
import { getSupabase } from "../config/supabaseClient";
import { getConfig } from "../config/env";
import { getPrisma } from "../config/prismaClient";

export class EvaluacionRepository {
  async list(): Promise<Evaluacion[]> {
    const prisma = getPrisma();
    if (prisma) {
      const rows = await prisma.evaluacion.findMany({
        select: { id: true, titulo: true },
        orderBy: { id: "asc" },
      });
      return rows as Evaluacion[];
    }

    const supabase = getSupabase();
    const { supabaseEvaluacionesTable } = getConfig();
    if (supabase && supabaseEvaluacionesTable) {
      const { data, error } = await supabase
        .from(supabaseEvaluacionesTable)
        .select("id,titulo")
        .order("id", { ascending: true });
      if (!error) return (data ?? []) as unknown as Evaluacion[];
      console.error("Supabase list evaluaciones error", error);
    }

    return [];
  }

  async getById(id: string): Promise<Evaluacion | null> {
    const prisma = getPrisma();
    if (prisma) {
      const row = await prisma.evaluacion.findUnique({
        where: { id },
        select: { id: true, titulo: true },
      });
      return (row as Evaluacion) ?? null;
    }

    const supabase = getSupabase();
    const { supabaseEvaluacionesTable } = getConfig();
    if (supabase && supabaseEvaluacionesTable) {
      const { data, error } = await supabase
        .from(supabaseEvaluacionesTable)
        .select("id,titulo")
        .eq("id", id)
        .maybeSingle();
      if (!error) return (data as unknown as Evaluacion) ?? null;
      console.error("Supabase get evaluacion error", error);
    }

    return null;
  }

  // ----- Evaluaciones realizadas (instancias) -----
  // Tipado mínimo para evitar depender de la generación local
  async listInstancias(): Promise<{
    id: string;
    estudianteId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
    createdAt: Date;
  }[]> {
    const prisma = getPrisma();
    if (!prisma) return [];
    return (prisma as any).EvaluacionEstudiante.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, estudianteId: true, salaId: true, tipoId: true, estadoId: true, puntaje: true, createdAt: true },
    });
  }

  async getInstanciaById(id: string): Promise<{
    id: string;
    estudianteId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
    createdAt: Date;
  } | null> {
    const prisma = getPrisma();
    if (!prisma) return null;
    return (prisma as any).EvaluacionEstudiante.findUnique({
      where: { id },
      select: { id: true, estudianteId: true, salaId: true, tipoId: true, estadoId: true, puntaje: true, createdAt: true },
    });
  }

  async createInstancia(input: {
    estudianteId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
  }): Promise<{
    id: string;
    estudianteId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
    createdAt: Date;
  }> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    return (prisma as any).EvaluacionEstudiante.create({
      data: input,
      select: { id: true, estudianteId: true, salaId: true, tipoId: true, estadoId: true, puntaje: true, createdAt: true },
    });
  }
  async actualizarInstancia(id: string, input: {
    estudianteId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    puntaje?: number | null;
  }): Promise<{
    id: string;
    estudianteId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
    createdAt: Date;
  } | null> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const updated = await (prisma as any).EvaluacionEstudiante.updateMany({
      where: { id },
      data: input,
    });
    if (updated.count === 0) return null;
    return this.getInstanciaById(id);
  }
  async eliminarInstancia(id: string): Promise<boolean> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    const deleted = await (prisma as any).EvaluacionEstudiante.deleteMany({
      where: { id },
    });
    return deleted.count > 0;
  }
}


