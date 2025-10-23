import { HealthRepository } from "../repositories/health.repository";


// functions/src/services/health.service.ts
// Servicio (reglas de negocio): orquesta repositorios y aplica la lógica.
// No conoce HTTP; devuelve datos puros para que el controlador los formatee.

export class HealthService {
  private readonly repo: HealthRepository;

  constructor(repo: HealthRepository = new HealthRepository()) {
    this.repo = repo;
  }

  async getHealth() {
    return this.repo.getStatus();
  }
}


