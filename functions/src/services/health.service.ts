import { HealthRepository } from "../repositories/health.repository";

/**
 * Servicio de health-check.
 *
 * @remarks
 * Actúa como capa de orquestación entre el controlador y `HealthRepository`.
 * No contiene lógica de negocio propia; delega directamente en el repositorio.
 * El repositorio acepta inyección para facilitar los tests unitarios.
 */
export class HealthService {
  private readonly repo: HealthRepository;

  /**
   * @param repo - Instancia de `HealthRepository` a usar. Por defecto crea una nueva.
   */
  constructor(repo: HealthRepository = new HealthRepository()) {
    this.repo = repo;
  }

  /**
   * Verifica el estado de la base de datos ejecutando un `SELECT 1`.
   *
   * @returns `{ ok: true }` si la base de datos responde correctamente.
   * @throws Error si la base de datos no está disponible.
   */
  async getHealth() {
    return this.repo.getStatus();
  }
}


