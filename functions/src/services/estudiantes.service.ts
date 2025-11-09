import { EstudianteRepository } from "../repositories/estudiante.repository"
import type { CreateEstudianteData } from "../interfaces/estudiante.interface"


export class EstudiantesService {
    private repo = EstudianteRepository

    async create(data: any) {
        return await this.repo.create(data)
    }

    async list() {
        return await this.repo.list()
    }

    async getGeneros() {
        return await this.repo.getGeneros()
    }

    async getSalas() {
        return await this.repo.getSalas()
    }
}