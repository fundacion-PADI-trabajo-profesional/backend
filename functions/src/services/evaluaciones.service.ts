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
}


