import { EncargadoRepository } from "../repositories/encargado-zona.repository";
import { AuthService } from "./auth.service";

/**
 * Servicio de gestión de encargados de zona.
 *
 * @remarks
 * Todas las operaciones (excepto `getCurrentEncargado`) son exclusivas del rol
 * `"equipo_padi"`. La creación de un encargado genera una cuenta en Supabase Auth
 * con contraseña temporal; en producción debería integrarse con un servicio de email
 * para notificar al usuario (el código del `EmailService` está comentado).
 */
export class EncargadosService {

    /**
     * Lista todos los encargados de zona.
     *
     * @param user - Usuario autenticado.
     * @returns Array de encargados con su zona asignada.
     * @throws Error si el usuario no es `"equipo_padi"`.
     */
    async list(user: { id: string; rol: string }) {
        if (user.rol === "equipo_padi") {
            return await EncargadoRepository.list();
        }
        throw new Error("No tienes permisos para ver Encargados de Zona.");
    }

    /**
     * Crea un encargado de zona generando una cuenta con contraseña temporal.
     *
     * @remarks
     * Genera una contraseña aleatoria (8 chars + sufijo `"Aa1!"`) y llama a
     * `AuthService.register`. En producción, la contraseña debería enviarse por
     * email al nuevo encargado (lógica comentada con `EmailService`).
     * La contraseña temporal se retorna en la respuesta para uso del administrador.
     *
     * @param data - Datos del encargado a crear.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"`).
     * @returns El resultado de `AuthService.register` más el campo `tempPassword`.
     * @throws Error si el rol no es `"equipo_padi"` o si el registro falla.
     */
    async create(data: {
        email: string;
        nombre: string;
        apellido: string;
        zona: string;
    }, user: { id: string; rol: string }) {

        // Solo equipo_padi puede crear encargados de zona
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede crear encargados de zona.");
        }

        // Generar contraseña aleatoria
        const generatedPassword = Math.random().toString(36).slice(-8) + "Aa1!";

        const result = await AuthService.register({
            email: data.email,
            password: generatedPassword,
            nombre: data.nombre,
            apellido: data.apellido,
            rol: "encargado_zona",
            zona: data.zona,
        });

        // TODO: reemplazar con EmailService.sendWelcomeEmail(data.email, data.nombre, generatedPassword)

        return result;
    }

    /**
     * Actualiza el perfil y la zona asignada de un encargado.
     *
     * @param id - UUID del encargado.
     * @param data - Nuevos valores para nombre, apellido, email y zona_id.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"`).
     * @returns El registro de `encargados` actualizado.
     * @throws Error si el rol no es `"equipo_padi"`.
     */
    async update(id: string, data: { nombre: string; apellido: string; email: string; zona_id: string }, user: { id: string; rol: string }) {
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede modificar encargados de zona.");
        }
        return await EncargadoRepository.update(id, {
            nombre: data.nombre,
            apellido: data.apellido,
            zona_id: data.zona_id
        });
    }

    /**
     * Retorna el perfil del encargado autenticado (endpoint `/encargados/me`).
     *
     * @param userId - UUID del encargado autenticado.
     * @returns Perfil con id, nombre, apellido, email y zona asignada.
     * @throws Error si el encargado no existe.
     */
    async getCurrentEncargado(userId: string) {
        return await EncargadoRepository.getByUserId(userId);
    }

    /**
     * Elimina un encargado de zona del sistema.
     *
     * @param id - UUID del encargado a eliminar.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"`).
     * @throws Error si el rol no es `"equipo_padi"`.
     */
    async delete(id: string, user: { id: string; rol: string }) {
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede eliminar encargados de zona.");
        }
        return await EncargadoRepository.delete(id);
    }
}
