import { DirectivoRepository } from "../repositories/directivo.repository";
import { getPrisma } from "../config/prismaClient";
import { DirectivoItem } from "../interfaces/directivo.interface";

export class DirectivosService {
    private repo = DirectivoRepository;

    async list(user: { id: string; rol: string }) {

        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return this.repo.list();
        } else {
            throw new Error("No tienes permisos para ver Directores de otras escuelas.");
        }

    }


    async listAvailable(user: { id: string; rol: string }) {
        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return this.repo.list();
        } else {
            throw new Error("No tienes permisos para ver Directores de otras escuelas.");
        }
    }

    async assignEscuela(directorId: string, escuelaId: string, user: { id: string; rol: string }) {
        if (user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tenés permisos para asignar escuelas a directivos.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        // 1) Verificar que la escuela exista
        const escuela = await prismaAny.escuelas.findUnique({
            where: { id: escuelaId },
            select: { id: true, zona: true },
        });

        if (!escuela) {
            throw new Error("Escuela no encontrada.");
        }

        // Si es encargado, limitamos la asignación a su zona.
        if (user.rol === "encargado_zona") {
            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                select: { id: true, zona: true },
            });

            if (!encargado) {
                throw new Error("No se encontró perfil de encargado de zona.");
            }

            if (escuela.zona !== encargado.zona) {
                throw new Error("Solo podés asignar escuelas de tu propia zona.");
            }
        }

        // 3) Verificar que el directivo exista y tenga rol director
        const director = await prismaAny.usuarioPerfil.findUnique({
            where: { id: directorId },
            select: { id: true, rol: true },
        });

        if (!director || director.rol !== "director") {
            throw new Error("No se encontró un directivo válido con ese ID.");
        }

        // 4) Regla de negocio: solo un director activo por escuela.
        // Se desasignan primero otros directores de esa escuela y luego se asigna el nuevo.
        const updated = await prismaAny.$transaction(async (tx: any) => {
            await tx.usuarioPerfil.updateMany({
                where: {
                    rol: "director",
                    escuela_id: escuela.id,
                    NOT: { id: directorId },
                },
                data: { escuela_id: null },
            });

            return await tx.usuarioPerfil.update({
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
        });

        return updated;
    }
}


