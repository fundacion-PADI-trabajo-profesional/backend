import { DocenteRepository } from "../repositories/docente.repository";
import type { DocenteItem } from "../interfaces/docente.interface";

export class DocentesService {
  private repo = DocenteRepository;

  async list() {
    const rows: DocenteItem[] = await this.repo.list();

    // Adaptamos el formato interno (con 'personas') al DTO que espera el frontend:
    // { id, nombre, apellido }
    return rows.map((row) => ({
      id: row.id,
      nombre: row.personas?.nombre ?? "",
      apellido: row.personas?.primer_apellido ?? "",
    }));
  }
}


