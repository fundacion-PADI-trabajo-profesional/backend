import { DirectivoRepository } from "../repositories/directivo.repository";
import { getPrisma } from "../config/prismaClient";

export class DirectivosService {
    private repo = DirectivoRepository;

    async list() {
        return this.repo.list();
    }

    async listAvailable() {
        return this.repo.listAvailable();
    }

    async assignEscuela(directorId: string, escuelaId: string, user: { id: string; rol: string }) {
        if (user.rol !== "encargado_zona") {
            throw new Error("No tenés permisos para asignar escuelas a directivos.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        // 1) Verificar que el usuario sea un encargado válido y obtener su zona
        const encargado = await prismaAny.encargados.findUnique({
            where: { usuario_id: user.id },
            select: { id: true, zona: true },
        });

        if (!encargado) {
            throw new Error("No se encontró perfil de encargado de zona.");
        }

        // 2) Verificar que la escuela exista y sea de su zona
        const escuela = await prismaAny.escuelas.findUnique({
            where: { id: escuelaId },
            select: { id: true, zona: true },
        });

        if (!escuela) {
            throw new Error("Escuela no encontrada.");
        }

        if (escuela.zona !== encargado.zona) {
            throw new Error("Solo podés asignar escuelas de tu propia zona.");
        }

        // 3) Verificar que el directivo exista y tenga rol director
        const director = await prismaAny.usuarioPerfil.findUnique({
            where: { id: directorId },
            select: { id: true, rol: true },
        });

        if (!director || director.rol !== "director") {
            throw new Error("No se encontró un directivo válido con ese ID.");
        }

        // 4) Actualizar su escuela asignada
        const updated = await prismaAny.usuarioPerfil.update({
            where: { id: directorId },
            data: { escuela_id: escuela.id },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                escuela: {
                    select: {
                        id: true,
                        nombre: true,
                    },
                },
            },
        });

        return updated;
    }
}


