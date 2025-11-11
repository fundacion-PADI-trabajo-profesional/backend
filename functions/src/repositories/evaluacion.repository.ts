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
  async listInstancias(filters?: {
    estudianteId?: string;
    profesorId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    id: string;
    estudiante_id: string; 
    profesor_id: string;   
    sala_id: number;       
    tipo_id: string;       
    estado_id: string;     
    puntaje?: number | null;
    fecha_creacion: Date;  
  }[]> {
    const prisma = getPrisma();
    if (!prisma) return [];
    const where: any = {};
    if (filters?.estudianteId) where.estudiante_id = filters.estudianteId;
    if (filters?.profesorId) where.profesor_id = filters.profesorId;
    if (typeof filters?.salaId === "number") where.sala_id = filters.salaId;
    if (filters?.tipoId) where.tipo_id = filters.tipoId;
    if (filters?.estadoId) where.estado_id = filters.estadoId;

    return prisma.evaluacionEstudiante.findMany({ // <-- 'e' minúscula
      where,
      skip: filters?.offset ?? 0,
      take: filters?.limit ?? 50,
      orderBy: { 
        fecha_creacion: "desc" 
      },
      select: { 
        id: true, 
        estudiante_id: true, 
        profesor_id: true,  
        sala_id: true,       
        tipo_id: true,       
        estado_id: true,     
        puntaje: true, 
        fecha_creacion: true,
        // Incluimos datos mínimos del estudiante para mostrar en el front
        estudiantes: {
          select: {
            id: true,
            personas: {
              select: {
                nombre: true,
                primer_apellido: true,
                segundo_apellido: true,
                dni: true,
              },
            },
          },
        },
      },
    });
  }

  async getInstanciaById(id: string): Promise<{
    id: string;
    estudiante_id: string; 
    profesor_id: string;  
    sala_id: number;       
    tipo_id: string;       
    estado_id: string;     
    puntaje?: number | null;
    fecha_creacion: Date;  
  } | null> {
    const prisma = getPrisma();
    if (!prisma) return null;
    return prisma.evaluacionEstudiante.findUnique({ // <-- 'e' minúscula
      where: { id },
      select: { 
        id: true, 
        estudiante_id: true, 
        profesor_id: true,  
        sala_id: true,       
        tipo_id: true,       
        estado_id: true,     
        puntaje: true, 
        fecha_creacion: true,
        estudiantes: {
          select: {
            id: true,
            personas: {
              select: {
                nombre: true,
                primer_apellido: true,
                segundo_apellido: true,
                dni: true,
              },
            },
          },
        },
      },
    });
  }

  async createInstancia(input: {
    estudianteId: string;
    profesorId: string;
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
  }): Promise<{
    id: string;
    estudiante_id: string;
    profesor_id: string;
    sala_id: number;
    tipo_id: string;
    estado_id: string;
    puntaje?: number | null;
    fecha_creacion: Date;  
  }> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available to create Evaluacion");

    return prisma.evaluacionEstudiante.create({
      data: {
        // Campo escalar (el único que no es una relación directa)
        puntaje: input.puntaje,
        estudiantes: {
          connect: { id: input.estudianteId }
        },
        profesores: {
          connect: { id: input.profesorId } // <-- AÑADIDO
        },
        salas: {
          connect: { id: input.salaId } // <-- AÑADIDO
        },        
        tipos_evaluacion: {
          connect: { id: input.tipoId } // <-- AÑADIDO
        },
        estados_evaluacion: {
          connect: { id: input.estadoId } 
        }
      },  
      
      // El 'select' estaba bien, pero no es necesario si las columnas
      // del 'input' se llamaran igual que en el schema (ej: estudiante_id)
      // Lo dejamos como estaba porque funciona.
      select: { 
        id: true, 
        estudiante_id: true, 
        profesor_id: true,   
        sala_id: true,       
        tipo_id: true,       
        estado_id: true,     
        puntaje: true, 
        fecha_creacion: true 
      },
    });
  }

//  async actualizarInstancia(id: string, input: {
//    estudianteId?: string;
//    salaId?: number;
//    tipoId?: string;
//    estadoId?: string;
//    puntaje?: number | null;
//  }): Promise<{
//    id: string;
//    estudianteId: string;
//    salaId: number;
//    tipoId: string;
//    estadoId: string;
//    puntaje?: number | null;
//    createdAt: Date;
//  } | null> {
//    const prisma = getPrisma();
//    if (!prisma) throw new Error("DB not available");
//    const updated = await (prisma as any).EvaluacionEstudiante.updateMany({
//      where: { id },
//      data: input,
//    });
//    if (updated.count === 0) return null;
//      return this.getInstanciaById(id);
//  }

  // En evaluacion.repository.ts

  async actualizarInstancia(id: string, input: {
    estudianteId?: string;
    profesorId?: string; 
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    puntaje?: number | null;
  }): Promise<{ 
    id: string;
    estudiante_id: string;   
    profesor_id: string;   
    sala_id: number;       
    tipo_id: string;       
    estado_id: string;     
    puntaje?: number | null;
    fecha_creacion: Date;  
  } | null> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");

    const dataToUpdate: any = {};
    if (input.estudianteId !== undefined) dataToUpdate.estudiante_id = input.estudianteId;
    if (input.profesorId !== undefined) dataToUpdate.profesor_id = input.profesorId;
    if (input.salaId !== undefined) dataToUpdate.sala_id = input.salaId;
    if (input.tipoId !== undefined) dataToUpdate.tipo_id = input.tipoId;
    if (input.estadoId !== undefined) dataToUpdate.estado_id = input.estadoId;
    if (input.puntaje !== undefined) dataToUpdate.puntaje = input.puntaje;
    
    const updated = await prisma.evaluacionEstudiante.updateMany({
      where: { id },
      data: dataToUpdate,
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


