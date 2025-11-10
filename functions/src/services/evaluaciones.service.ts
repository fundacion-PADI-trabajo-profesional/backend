import { Evaluacion } from "../interfaces/evaluacion.interface";
import { EvaluacionRepository } from "../repositories/evaluacion.repository";

export class EvaluacionesService {
  private readonly repo: EvaluacionRepository;

  constructor(repo: EvaluacionRepository = new EvaluacionRepository()) {
    this.repo = repo;
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
    profesorId: string; // <-- AÑADIDO
    salaId: number;
    tipoId: string;
    estadoId: string;
    puntaje?: number | null;
  }) {
    return this.repo.createInstancia(input);
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
}


