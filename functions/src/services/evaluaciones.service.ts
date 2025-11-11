import { Evaluacion } from "../interfaces/evaluacion.interface";
import { EvaluacionRepository } from "../repositories/evaluacion.repository";
import { getPrisma } from "../config/prismaClient";

export class EvaluacionesService {
  private readonly repo: EvaluacionRepository;

  constructor(repo: EvaluacionRepository = new EvaluacionRepository()) {
    this.repo = repo;
  }

  private async ensureProfesorForUsuario(usuarioPerfilId: string): Promise<string> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("DB not available");
    // Si ya existe un profesor con el mismo UUID, lo usamos
    const existing = await (prisma as any).profesores.findUnique({ where: { id: usuarioPerfilId } });
    if (existing) return usuarioPerfilId;
    // Obtenemos datos básicos del usuario para crear Personas
    const usuario = await (prisma as any).usuarioPerfil.findUnique({
      where: { id: usuarioPerfilId },
      select: { nombre: true, apellido: true },
    });
    // Creamos la persona mínima
    const persona = await (prisma as any).personas.create({
      data: {
        nombre: usuario?.nombre ?? null,
        primer_apellido: usuario?.apellido ?? null,
      },
    });
    // Creamos el profesor con el mismo id que el usuario (para mapear 1:1)
    await (prisma as any).profesores.create({
      data: {
        id: usuarioPerfilId,
        persona_id: persona.id,
      },
    });
    return usuarioPerfilId;
  }

  async list(): Promise<Evaluacion[]> {
    return this.repo.list();
  }

  async getById(id: string): Promise<Evaluacion | null> {
    return this.repo.getById(id);
  }

  // Instancias (evaluaciones realizadas)
  listInstancias(filters?: {
    estudianteId?: string;
    profesorId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listInstancias(filters);
  }

  getInstanciaById(id: string) {
    return this.repo.getInstanciaById(id);
  }

  createInstancia(input: {
    estudianteId: string;
    profesorId: string; // usuarioPerfil.id del docente
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
  }) {
    return this.ensureProfesorAndCreate(input);
  }
  actualizarInstancia(id: string, input: {
    estudianteId?: string;
    salaId?: number;
    tipoId?: string;
    estadoId?: string;
    puntaje?: number | null;
  }) {
    return this.repo.actualizarInstancia(id, input);
  }
  eliminarInstancia(id: string) {
    return this.repo.eliminarInstancia(id);
  }

  private async ensureProfesorAndCreate(input: {
    estudianteId: string;
    profesorId: string; // usuarioPerfil.id
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
  }) {
    const profesorId = await this.ensureProfesorForUsuario(input.profesorId);
    return this.repo.createInstancia({
      ...input,
      profesorId,
    });
  }
}



