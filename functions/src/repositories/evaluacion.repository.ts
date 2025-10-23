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
}


