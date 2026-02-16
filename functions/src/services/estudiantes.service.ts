import { EstudianteRepository } from "../repositories/estudiante.repository"
import type { CreateEstudianteData } from "../interfaces/estudiante.interface"
import { getPrisma } from "../config/prismaClient"


export class EstudiantesService {
    private repo = EstudianteRepository

    async create(
        data: CreateEstudianteData,
        actor?: { id: string; rol: string },
    ) {
        if (actor?.rol === "docente") {
            if (!data.aula_id) {
                throw new Error("Debes seleccionar un aula para registrar al estudiante.");
            }

            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const asignacion = await prismaAny.profesoresAulas.findFirst({
                where: {
                    profesor_id: actor.id,
                    aula_id: data.aula_id,
                    fecha_fin: null,
                },
                include: {
                    aula: {
                        select: {
                            id: true,
                            sala_id: true,
                            escuela_id: true,
                        },
                    },
                },
            });

            if (!asignacion?.aula) {
                throw new Error("No tienes permisos para crear estudiantes en esta aula.");
            }

            // Forzamos consistencia con el aula asignada al docente.
            data.sala_id = asignacion.aula.sala_id;
            data.escuela_id = asignacion.aula.escuela_id;
        }

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
    async listByEscuela(escuelaId: string) {
        // Llama al método que definiremos en el repositorio
        return await this.repo.listByEscuela(escuelaId);
    }
}