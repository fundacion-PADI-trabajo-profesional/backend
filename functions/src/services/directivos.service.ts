import { DirectivoRepository } from "../repositories/directivo.repository";
import { withRLSContext } from "../config/prismaClient";
import { DirectivoItem } from "../interfaces/directivo.interface";

/**
 * Servicio de gestión de directivos (usuarios con rol `"director"`).
 *
 * @remarks
 * Aplica control de acceso por rol antes de delegar en `DirectivoRepository`.
 * La regla principal de negocio es que solo puede haber un director activo por escuela;
 * al asignar un nuevo director, se desasignan los anteriores en una transacción.
 */
export class DirectivosService {
    private repo = DirectivoRepository;

    /**
     * Lista todos los directivos del sistema con su escuela asignada.
     *
     * @param user - Usuario autenticado que realiza la operación.
     * @returns Array de {@link DirectivoItem}.
     * @throws Error si el usuario no tiene rol `"equipo_padi"` ni `"encargado_zona"`.
     */
    async list(user: { id: string; rol: string }) {

        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return this.repo.list();
        } else {
            throw new Error("No tienes permisos para ver Directores de otras escuelas.");
        }

    }


    /**
     * Lista los directivos sin escuela asignada (disponibles para asignar).
     *
     * @param user - Usuario autenticado.
     * @returns Array de {@link DirectivoItem} sin campo `escuela`.
     * @throws Error si el usuario no tiene el rol requerido.
     */
    async listAvailable(user: { id: string; rol: string }) {
        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return this.repo.list();
        } else {
            throw new Error("No tienes permisos para ver Directores de otras escuelas.");
        }
    }

    /**
     * Asigna una escuela a un directivo en una transacción atómica.
     *
     * @remarks
     * Reglas de negocio:
     * - Solo `"equipo_padi"` y `"encargado_zona"` pueden asignar.
     * - Los encargados de zona solo pueden asignar escuelas de su propia zona.
     * - Solo puede haber un director activo por escuela: desasigna a los anteriores
     *   antes de asignar al nuevo.
     *
     * @param directorId - UUID del directivo a asignar.
     * @param escuelaId - UUID de la escuela destino.
     * @param user - Usuario autenticado que realiza la operación.
     * @returns El perfil del directivo actualizado con datos de la escuela.
     * @throws Error si la escuela no existe, el directivo no es válido, o el usuario no tiene permisos.
     */
    async assignEscuela(directorId: string, escuelaId: string, user: { id: string; rol: string }) {
        if (user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tenés permisos para asignar escuelas a directivos.");
        }

        return withRLSContext(async (tx) => {

            // 1) Verificar que la escuela exista
            const escuela = await tx.escuelas.findUnique({
                where: { id: escuelaId },
                select: { id: true, zona: true },
            });

            if (!escuela) {
                throw new Error("Escuela no encontrada.");
            }

            // Si es encargado, limitamos la asignación a su zona.
            if (user.rol === "encargado_zona") {
                const encargado = await tx.encargados.findUnique({
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
            const director = await tx.usuarioPerfil.findUnique({
                where: { id: directorId },
                select: { id: true, rol: true },
            });

            if (!director || director.rol !== "director") {
                throw new Error("No se encontró un directivo válido con ese ID.");
            }

            // 4) Regla de negocio: solo un director activo por escuela.
            await tx.usuarioPerfil.updateMany({
                where: {
                    rol: "director",
                    escuela_id: escuela.id,
                    NOT: { id: directorId },
                },
                data: { escuela_id: null },
            });

            return tx.usuarioPerfil.update({
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
    }
}


