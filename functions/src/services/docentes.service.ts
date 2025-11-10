import { DocenteRepository } from "../repositories/docente.repository";

export class DocentesService {
  private repo = DocenteRepository;

  async list() {
    return this.repo.list();
  }
}


