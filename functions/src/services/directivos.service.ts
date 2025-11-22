import { DirectivoRepository } from "../repositories/directivo.repository";

export class DirectivosService {
    private repo = DirectivoRepository;

    async list() {
        return this.repo.list();
    }
}


